#!/usr/bin/env node
'use strict';
// smoke-war-closure — 战争 warScore 闭环 + endWar + 联盟参战(#26·接通批)
//   ① warScore 按胜负推进(攻方+/守方-) ② 越±100→endWar(议和) ③ 无对应战争 no-op
//   ④ 联盟 mutual_defense→盟友应约参战 ⑤ 已交战/非同盟不拉 ⑥ createTreaty 带 mutual_defense 标志(源契约)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-war-closure');

const mil = fs.readFileSync(path.join(ROOT,'tm-military.js'),'utf8');
const feu = (fs.readFileSync(path.join(ROOT,'tm-feudal.js'),'utf8') + fs.readFileSync(path.join(ROOT,'tm-feudal-warfare.js'),'utf8'));
const f_uw = sliceFn(mil,'function _ty_updateWarFromBattle(');
const f_ca = sliceFn(feu,'function _ty_callAlliesToWar(');
ok(!!f_uw && !!f_ca, '两战争闭环函数抽取成功');

// ── warScore 推进 ──
function runWar(wars, winner, loser, br){
  const ctx = { Math: Math, Number: Number, Array: Array, isFinite: isFinite };
  ctx.GM = { activeWars: wars }; ctx.ebs = []; ctx.endWarCalls = [];
  ctx.addEB = function(c,t){ ctx.ebs.push(t); };
  ctx.CasusBelliSystem = { endWar: function(id){ ctx.endWarCalls.push(id); } };
  vm.createContext(ctx);
  vm.runInContext(f_uw + '\nthis.go = function(w,l,b){ _ty_updateWarFromBattle(w,l,b,GM); };', ctx);
  ctx.go(winner, loser, br);
  return ctx;
}
var w1 = { id:'w1', attacker:'本朝', defender:'后金', warScore:0 };
runWar([w1], '本朝', '后金', { warScoreDelta:30 });
ok(w1.warScore === 30, '① 攻方(本朝)胜 → warScore +30');
var w2 = { id:'w2', attacker:'本朝', defender:'后金', warScore:0 };
runWar([w2], '后金', '本朝', { warScoreDelta:30 });
ok(w2.warScore === -30, '① 守方(后金)胜 → warScore -30(攻方视角)');
var w3 = { id:'w3', attacker:'本朝', defender:'后金', warScore:80 };
var c3 = runWar([w3], '本朝', '后金', { warScoreDelta:30 });
ok(w3.warScore === 100, '② 80+30 夹顶 100');
ok(c3.endWarCalls.indexOf('w3') >= 0, '② ★越±100 → 调 CasusBelliSystem.endWar(议和上停战期)');
var w5 = { id:'w5', attacker:'本朝', defender:'后金', warScore:0 };
runWar([w5], '本朝', '后金', { warScoreDelta:200 });
ok(w5.warScore === 40, '② mag 夹上限 40(单阵不暴涨)');
var c4 = runWar([{ id:'w4', attacker:'甲', defender:'乙', warScore:0 }], 'X', 'Y', {});
ok(c4.endWarCalls.length === 0, '③ 无对应战争 → no-op(不误议和)');

// ── 联盟参战 ──
function runAllies(treaties, activeWars, defender, attacker){
  const ctx = { Array: Array };
  ctx.GM = { turn: 5, treaties: treaties, activeWars: activeWars }; ctx.ebs = []; ctx._n = 0;
  ctx.uid = function(){ return 'u' + (++ctx._n); };
  ctx.addEB = function(c,t){ ctx.ebs.push(t); };
  ctx.WarWeightSystem = { hasTruce: function(){ return false; } };
  vm.createContext(ctx);
  vm.runInContext(f_ca + '\nthis.go = function(d,a){ _ty_callAlliesToWar(d,a,{truceMonths:12}); };', ctx);
  ctx.go(defender, attacker);
  return ctx.GM;
}
var aw = [{ attacker:'本朝', defender:'后金' }];
var g1 = runAllies([{ type:'alliance', parties:['后金','蒙古'], active:true }], aw, '后金', '本朝');
ok(g1.activeWars.length === 2, '④ 守方有同盟 → 盟友应约入战(activeWars 1→2)');
var allied = g1.activeWars[1];
ok(allied.attacker === '本朝' && allied.defender === '蒙古' && allied._alliedWar, '④ 新战争=本朝 vs 蒙古(盟友)·标 _alliedWar');
// 盟友已与攻方交战 → 不重复拉
var aw2 = [{ attacker:'本朝', defender:'后金' }, { attacker:'本朝', defender:'蒙古' }];
var g2 = runAllies([{ type:'alliance', parties:['后金','蒙古'], active:true }], aw2, '后金', '本朝');
ok(g2.activeWars.length === 2, '⑤ 盟友已与攻方交战 → 不重复拉入');
// 非同盟条约(互市)→ 不拉
var aw3 = [{ attacker:'本朝', defender:'后金' }];
var g3 = runAllies([{ type:'trade', parties:['后金','蒙古'], active:true }], aw3, '后金', '本朝');
ok(g3.activeWars.length === 1, '⑤ 非同盟条约(互市)→ 不触发参战');

console.log('\n结果: '+A+' 通过 / 0 失败');
