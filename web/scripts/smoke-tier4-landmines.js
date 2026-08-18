#!/usr/bin/env node
'use strict';
// smoke-tier4-landmines — 静默地雷+性能(簇8)
//   #3 民心 trueIndex NaN 守卫 #4 路径数组非数字键幽灵守卫 #5 伏笔 Set 化+上限 #6 官制签名补 playerFaction #7 game-loop capture
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8'); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-tier4-landmines');

// ── #3 民心 trueIndex NaN 守卫 ──
const ac = read('tm-authority-complete.js');
const tickSrc = sliceFn(ac, 'function _tickMinxinConsequences(');
ok(!!tickSrc, '_tickMinxinConsequences 抽取成功');
ok(/var _ti = \(typeof mx\.trueIndex === 'number' && isFinite/.test(tickSrc), '★trueIndex 安全访问器 _ti 在位');
ok(tickSrc.indexOf('mx.trueIndex / 60') < 0 && /_ti \/ 60/.test(tickSrc), '改革容忍度改用 _ti(不再裸 mx.trueIndex)');
function runTick(mx){
  const G = { minxin: mx, population: { national:{mouths:50000000}, military:{} }, fiscal:null };
  const ctx = { Math:Math, Number:Number, isFinite:isFinite, Object:Object, global:{ GM:G, AuthorityEngines:null } };
  vm.createContext(ctx);
  vm.runInContext(tickSrc + '\nthis.go=_tickMinxinConsequences;', ctx);
  ctx.go({}, 1);
  return G;
}
const gNew = runTick({ value: 50 }); // legacy {value} 形态·无 trueIndex
ok(isFinite(gNew._conscriptEffMult), '★mx 无 trueIndex → _conscriptEffMult 仍有限(非 NaN)');
ok(isFinite(gNew._reformToleranceMult), '★_reformToleranceMult 仍有限(非 NaN)');
// swap-test:旧逻辑裸 mx.trueIndex → NaN
function runOld(mx){
  const old = tickSrc
    .replace(/var _ti = [\s\S]*?if \(!isFinite\(_ti\)\) _ti = 60;\n/, '')
    .replace(/_ti \//g, 'mx.trueIndex /').replace(/_ti </g, 'mx.trueIndex <');
  const G = { minxin: mx, population:{national:{mouths:50000000},military:{}}, fiscal:null };
  const ctx = { Math:Math, Number:Number, isFinite:isFinite, Object:Object, global:{ GM:G, AuthorityEngines:null } };
  vm.createContext(ctx);
  vm.runInContext(old + '\nthis.go=_tickMinxinConsequences;', ctx);
  ctx.go({}, 1);
  return G;
}
const gOld = runOld({ value: 50 });
ok(Number.isNaN(gOld._conscriptEffMult), '★swap-test:旧逻辑无 trueIndex → _conscriptEffMult = NaN(复现地雷)');

// ── #4 路径数组非数字键幽灵守卫 ──
const pu = read('tm-ai-change-pathutils.js');
ok(/!r\.parent \|\| \(!r\.exists && !declaredDynamic\)/.test(pu), '★路径写口仅允许更新已存在或显式声明的 schema 路径');
const PathUtils = require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
const holder = { rows: [{ morale: 50 }] };
const r1 = PathUtils.applyPathSet(holder, 'rows.名字.morale', 60);
ok(r1.ok === false && holder.rows['名字'] === undefined, '★未知数组名键被拒(无幽灵属性 arr[名字])');
const r2 = PathUtils.applyPathSet(holder, 'rows.0.morale', 60);
ok(r2.ok === true && holder.rows[0].morale === 60, '数组上已存数字索引放行');

// ── #5 伏笔 Set 化 + 上限 ──
const ea = read('tm-endturn-apply.js');
ok(/new Set\(existing\.content\.replace/.test(ea), '★伏笔回收用 Set(原逐字 indexOf)');
ok(/existWords\.has\(ch\)/.test(ea), 'Set.has 成员判定');
ok(/GM\._foreshadowings\.length > 250/.test(ea), '★_foreshadowings 上限 250(防无界增长)');
// 复刻上限:251 条 → 汰至 未回收 + 最近60已回收
function cap(arr){
  if (arr.length > 250) {
    var keep = arr.filter(function(f){ return f && !f.resolved; });
    var res = arr.filter(function(f){ return f && f.resolved; });
    arr = keep.concat(res.slice(-60));
  }
  return arr;
}
const many = [];
for (let i=0;i<200;i++) many.push({resolved:true, id:i});       // 200 已回收
for (let i=0;i<55;i++) many.push({resolved:false, id:1000+i});  // 55 未回收
const capped = cap(many);
ok(capped.length === 115, '★255 条 → 汰至 115(55未回收 + 60最近已回收)');
ok(capped.filter(function(f){return !f.resolved;}).length === 55, '未回收全保留(待呼应)');

// ── #6 官制签名补 playerFaction ──
const off = read('tm-office-system.js');
ok(/\(GM\.chars \|\| \[\]\)\.length \+ '\|' \+ \(GM\.playerFaction \|\| ''\)/.test(off), '★官制派生签名纳入 GM.playerFaction(阵营切换触发重派生)');

// ── #7 game-loop capture ──
const gl = (read('tm-game-loop.js') + read('tm-game-loop-wentian-hardchange.js'));
ok(/catch\(_eR\)\{ if \(window\.TM && TM\.errors/.test(gl), '★ensureCharResources 空 catch 改 capture');
ok(/catch\(_eM\)\{ if \(window\.TM && TM\.errors/.test(gl), '★updatePublicTreasuryMirror 空 catch 改 capture');

console.log('\n结果: '+A+' 通过 / 0 失败');
