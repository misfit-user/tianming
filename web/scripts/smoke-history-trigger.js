#!/usr/bin/env node
'use strict';
// smoke-history-trigger — 刚性史事触发门槛 + narrative 显示(真bug)
//   实跑 checkHistoryEvents:① triggerTurn 把关(魏忠贤 triggerTurn:3 不再开局触发) ② 到回合才触发
//   ③ string-only trigger 无 triggerTurn → 不误触发(hasGate) ④ object trigger year 仍兼容 ⑤ narrative 显示契约
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-history-trigger');

const hist = fs.readFileSync(path.join(ROOT,'tm-history-events.js'),'utf8');
const checkSrc = sliceFn(hist, 'function checkHistoryEvents()');
ok(!!checkSrc, 'checkHistoryEvents 抽取成功');
// checkHistoryEvents 调用 _rigid* / _applyRigidHistoryDeath 这一簇顶层 helper（刚性史实事件·2026-07-08 加）·
// 隔离跑须把整簇一并纳入 vm·否则 ReferenceError（簇内对 GM/P/_fuzzyFindChar 等均 typeof 守卫·vm 缺位优雅回退）。
const _rh_a = hist.indexOf('function _rigidDeathTargetAlreadyDead');
const _rh_b = hist.indexOf('function _historyEventToIssue');
const rigidHelpers = (_rh_a >= 0 && _rh_b > _rh_a) ? hist.slice(_rh_a, _rh_b) : '';
ok(!!rigidHelpers, '刚性 _rigid* helper 簇抽取成功');

function runTurn(turn, rigids, year, conf){
  const fired = [];
  const ctx = {};
  ctx.getCurrentYear = function(){ return year || 1627; };
  ctx.getCurrentMonth = function(){ return 1; };
  ctx.showHistoryEventModal = function(ev){ fired.push(ev.id); };
  ctx._dbg = function(){};
  ctx.GM = { turn: turn, rigidHistoryEvents: rigids, triggeredHistoryEvents: {} };
  // conf 缺省 {} 与旧行为一致:_rigidHistoryEventShouldFire 读 P.conf.gameMode||'yanyi'、P.conf.rigidHistEventsOff(undefined→照旧触发)
  ctx.P = { conf: conf || {} };
  vm.createContext(ctx);
  vm.runInContext(rigidHelpers + '\n' + checkSrc + '\nthis.run = checkHistoryEvents;', ctx);
  ctx.run();
  return fired;
}

const wei = { id:'rh_weiSuicide', triggerTurn:3, name:'魏忠贤自缢阜城', trigger:'阉党权势值 < 50 且 皇威 > 50', narrative:'夜宿阜城·闻歌小曲骂九千岁·遂自缢。' };
const ke  = { id:'rh_keshiDie',   triggerTurn:4, name:'客氏杖毙',       trigger:'魏忠贤已死', narrative:'杖毙于浣衣局。' };

// ① 开局(turn 1)不触发(原 bug:魏忠贤开局即自缢)
var t1 = runTurn(1, [wei, ke]);
ok(t1.indexOf('rh_weiSuicide') < 0, '① ★turn 1 魏忠贤不触发(triggerTurn:3 把关·修开局自缢)');
ok(t1.length === 0, '① turn 1 无任何刚性史事触发');

// ② 到 triggerTurn 才触发
var t3 = runTurn(3, [wei, ke]);
ok(t3.indexOf('rh_weiSuicide') >= 0, '② turn 3 魏忠贤触发(到 triggerTurn)');
ok(t3.indexOf('rh_keshiDie') < 0, '② turn 3 客氏(triggerTurn:4)尚不触发');
var t4 = runTurn(4, [wei, ke]);
ok(t4.indexOf('rh_keshiDie') >= 0 && t4.indexOf('rh_weiSuicide') >= 0, '② turn 4 客氏+魏忠贤皆达回合可触发');

// ③ string-only trigger 无 triggerTurn → 不误触发(hasGate 防御)
var bad = { id:'bad_noGate', trigger:'某些条件', narrative:'x' };
ok(runTurn(1, [bad]).indexOf('bad_noGate') < 0, '③ string trigger 无 triggerTurn → 不开局误触发(原 bug 会触发)');

// ④ object trigger year 结构化仍兼容
var objHit = { id:'obj_hit', trigger:{ year:1627 }, narrative:'y' };
var objMiss = { id:'obj_miss', trigger:{ year:1700 }, narrative:'z' };
ok(runTurn(1, [objHit], 1627).indexOf('obj_hit') >= 0, '④ object trigger year 命中→触发(向后兼容)');
ok(runTurn(1, [objMiss], 1627).indexOf('obj_miss') < 0, '④ object trigger year 不符→不触发');

// ⑥ ★还账·演义模式一键关注定史实事件(P.conf.rigidHistEventsOff=true)→注定事件不触发(由玩家改写历史)
var t3off = runTurn(3, [wei, ke], 1627, { gameMode:'yanyi', rigidHistEventsOff:true });
ok(t3off.indexOf('rh_weiSuicide') < 0, '⑥ ★演义 rigidHistEventsOff=true → turn 3 魏忠贤注定事件不触发(一键全关)');
ok(t3off.length === 0, '⑥ 演义关注定事件后·本回合无任何刚性史事触发');
// ⑥对照:演义默认(未关)同回合仍触发·证明是开关起效而非恒不触发
var t3on = runTurn(3, [wei, ke], 1627, { gameMode:'yanyi' });
ok(t3on.indexOf('rh_weiSuicide') >= 0, '⑥ 对照:演义未关时 turn 3 仍触发(证开关语义·非恒关)');

// ⑦ ★反退化(设flag必配设置开关):设置面板代码里须存在写 rigidHistEventsOff 的开关·防再退化成有读端无写端的死 flag
const patches = fs.readFileSync(path.join(ROOT,'tm-patches.js'),'utf8');
var _hasWriteToggle = /_togglePConf\(\\?['"]rigidHistEventsOff/.test(patches) || /P\.conf\.rigidHistEventsOff\s*=/.test(patches);
ok(_hasWriteToggle, '⑦ ★设置面板(tm-patches.js)存在写 rigidHistEventsOff 的开关(防有读端无写端退化)');

console.log('\n结果: '+A+' 通过 / 0 失败');
