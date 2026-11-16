#!/usr/bin/env node
'use strict';
// smoke-diplo-consequence — 外交资源/领土后果接通(#25·接通批)
//   真跑 _applyDiploResourceConsequence(FiscalEngine 桩):赔款/朝贡/献贡/互市/并吞/承认独立
//   ① 玩家为一方→动国库(spend/add) ② 两 AI 势力→动抽象 money(国库不动) ③ 额由对方 strength 派生 ④ 并吞领土/兵转移
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-diplo-consequence');

const rel = fs.readFileSync(path.join(ROOT,'tm-relations.js'),'utf8');
const f1 = sliceFn(rel,'function _diploFindFac('), f2 = sliceFn(rel,'function _diploPlayerFac('), f3 = sliceFn(rel,'function _diploTributeAmt('), f4 = sliceFn(rel,'function _applyDiploResourceConsequence(');
ok(f1&&f2&&f3&&f4, '外交后果四函数抽取成功');

function setup(facs, playerFac){
  const ctx = { Math: Math, Number: Number, Array: Array };
  ctx.GM = { turn: 5, facs: facs };
  ctx.P = { playerFactionName: playerFac };
  ctx.spendCalls = []; ctx.addCalls = []; ctx.ebs = []; ctx._rels = {};
  ctx.FiscalEngine = { spendFromGuoku:function(a,t){ ctx.spendCalls.push({a:a,t:t}); }, addToGuoku:function(a,t){ ctx.addCalls.push({a:a,t:t}); } };
  ctx.addEB = function(c,t){ ctx.ebs.push(c+':'+t); };
  ctx.ensureFactionRelation = function(a,b){ var k=a+'|'+b; if(!ctx._rels[k]) ctx._rels[k]={}; return ctx._rels[k]; };
  vm.createContext(ctx);
  vm.runInContext([f1,f2,f3,f4].join('\n')+'\nthis.go=_applyDiploResourceConsequence; this.amt=_diploTributeAmt;', ctx);
  return ctx;
}

// ③ 额派生:strength 50→30000(对齐旧硬编)·100→60000
var c0 = setup([], '本朝');
ok(c0.amt(50).money === 30000, '③ strength 50 → 30000 两(对齐旧硬编)');
ok(c0.amt(100).money === 60000, '③ strength 100 → 60000 两(随实力)');
ok(c0.amt(500).money === 120000, '③ 夹上限 120000(强藩不无限)');

// ① 玩家赔款(本朝 strength80 → 后金 strength100):出帑 = 收方 100→60000
var c1 = setup([{name:'本朝',strength:80,provinceIds:['p1']},{name:'后金',strength:100,provinceIds:['p2']}], '本朝');
c1.go('本朝','后金','pay_indemnity');
ok(c1.spendCalls.length === 1 && c1.spendCalls[0].a.money === 60000, '① 玩家赔款→spendFromGuoku 60000(出帑·额由收方实力)');
ok(c1.addCalls.length === 0, '① 赔款不入帑');

// ① 玩家索贡(本朝 demand 后金):入帑
var c2 = setup([{name:'本朝',strength:80},{name:'后金',strength:100}], '本朝');
c2.go('本朝','后金','demand_tribute');
ok(c2.addCalls.length === 1 && c2.addCalls[0].a.money === 60000, '① 玩家索贡→addToGuoku 60000(入帑)');

// ① 玩家献贡(本朝 pay 后金):出帑
var c3 = setup([{name:'本朝',strength:80},{name:'后金',strength:100}], '本朝');
c3.go('本朝','后金','pay_tribute');
ok(c3.spendCalls.length === 1 && c3.spendCalls[0].a.money === 60000, '① 玩家献贡→spendFromGuoku 60000(出帑)');

// ④ 并吞:弱藩(strength40,prov p3) 被本朝吞·strength归0+领土并入+标 absorbed
var c4 = setup([{name:'本朝',strength:80,provinceIds:['p1']},{name:'弱藩',strength:40,provinceIds:['p3']}], '本朝');
c4.go('本朝','弱藩','annex_vassal');
var benchao = c4.GM.facs[0], ruofan = c4.GM.facs[1];
ok(ruofan.strength === 0 && ruofan._absorbedBy === '本朝', '④ 被吞势力 strength 归 0 + 标 _absorbedBy');
ok(benchao.strength === 80 + Math.round(40*0.6), '④ 并吞方 strength +被吞×0.6(80→104)');
ok(benchao.provinceIds.indexOf('p3') >= 0, '④ 被吞领土并入并吞方');

// ① 互市:玩家方→通商红利入帑 + tradeOpen 标记
var c5 = setup([{name:'本朝',strength:80},{name:'荷兰',strength:100}], '本朝');
c5.go('本朝','荷兰','open_market');
ok(c5.addCalls.length === 1 && c5.addCalls[0].a.money === 18000, '① 互市→通商红利 18000 入帑(60000×0.3)');
ok(c5._rels['本朝|荷兰'] && c5._rels['本朝|荷兰'].tradeOpen === true, '① 互市标 tradeOpen');

// ② 两 AI 势力间(无玩家)→国库不动·动抽象 money
var c6 = setup([{name:'后金',strength:100,money:50000},{name:'蒙古',strength:60,money:30000}], '本朝');
c6.go('后金','蒙古','pay_indemnity');  // 后金赔款给蒙古·额由收方蒙古 60→36000
ok(c6.spendCalls.length === 0 && c6.addCalls.length === 0, '② 两 AI 势力交互→国库(玩家帑廪)不动');
ok(c6.GM.facs[0].money === 50000 - 36000 && c6.GM.facs[1].money === 30000 + 36000, '② 两 AI→动抽象 faction.money(后金-36000/蒙古+36000)');

console.log('\n结果: '+A+' 通过 / 0 失败');
