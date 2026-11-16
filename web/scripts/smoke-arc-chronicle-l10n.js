#!/usr/bin/env node
'use strict';
// smoke-arc-chronicle-l10n — 角色弧线/编年记事 type 英文枚举→中文(纯安全·display-only)
//   ① ARC_TYPE_CN/_arcTypeCN 实跑:英文枚举→中文·中文透传·空→纪事·值全中文
//   ② 两渲染点(tabMemory/tabBenji)走 _arcTypeCN·零裸 esc(a.type)
//   ③ CHRONICLE_TYPE_CN/_chronicleTypeCN 实跑:category 优先·type 英文→中文兜底·空→长期事势·未知透传
//   ④ 编年 active 行 type/tags 走 _chronicleTypeCN·零裸 t.type||'长期事势'
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-arc-chronicle-l10n');

// ── ① 角色弧线 ARC_TYPE_CN + _arcTypeCN ──
const tuzhi = fs.readFileSync(path.join(ROOT,'tm-renwu-tuzhi.js'),'utf8');
const arcMapSrc = tuzhi.match(/var ARC_TYPE_CN=\{[^;]*\};/);
ok(!!arcMapSrc, '① ARC_TYPE_CN 映射表存在');
const arcFnSrc = sliceFn(tuzhi, 'function _arcTypeCN(');
ok(!!arcFnSrc, '① _arcTypeCN 抽取成功');
{
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(arcMapSrc[0]+'\n'+arcFnSrc+'\nthis.M=ARC_TYPE_CN; this.F=_arcTypeCN;', ctx);
  ok(ctx.F('dismissal')==='罢免', '① dismissal→罢免');
  ok(ctx.F('betrayal')==='背弃', '① betrayal→背弃');
  ok(ctx.F('arc_archive')==='早年事迹', '① arc_archive→早年事迹');
  ok(ctx.F('title_revoke')==='褫夺', '① title_revoke→褫夺');
  ok(ctx.F('retirement')==='致仕', '① retirement→致仕');
  ok(ctx.F('事')==='事', '① 中文值透传(事→事)');
  ok(ctx.F('')==='纪事', '① 空→纪事兜底');
  ok(!/[a-zA-Z]/.test(Object.keys(ctx.M).map(function(k){return ctx.M[k];}).join('')), '① 映射值全中文无英文残留');
}
// ── ② 渲染点契约 ──
ok(tuzhi.indexOf('esc(a.type)')<0, '② 零裸 esc(a.type)(英文不再直显)');

// ── ③ 编年 CHRONICLE_TYPE_CN + _chronicleTypeCN ──
const recs = fs.readFileSync(path.join(ROOT,'phase8-formal-records.js'),'utf8');
const chMapSrc = recs.match(/var CHRONICLE_TYPE_CN=\{[^;]*\};/);
ok(!!chMapSrc, '③ CHRONICLE_TYPE_CN 映射表存在');
const chFnSrc = sliceFn(recs, 'function _chronicleTypeCN(');
ok(!!chFnSrc, '③ _chronicleTypeCN 抽取成功');
{
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(chMapSrc[0]+'\n'+chFnSrc+'\nthis.F=_chronicleTypeCN;', ctx);
  ok(ctx.F({category:'文教',type:'keju'})==='文教', '③ category 优先(文教 胜过 keju)');
  ok(ctx.F({category:'',type:'changchao_pending'})==='常朝待落实', '③ category空→type英文映射(changchao_pending→常朝待落实)');
  ok(ctx.F({type:'scheme'})==='阴谋', '③ scheme→阴谋');
  ok(ctx.F({type:'pending_memorial'})==='奏疏留中', '③ pending_memorial→奏疏留中');
  ok(ctx.F({})==='长期事势', '③ 空对象→长期事势兜底');
  ok(ctx.F({category:'',type:'未知键'})==='未知键', '③ 未知键透传(不丢字)');
}
// ── ④ 编年 active 行契约 ──
ok(recs.indexOf("type: t.type || '长期事势'")<0, '④ 零裸 type: t.type||长期事势(英文不再当 chip)');

console.log('\n结果: '+A+' 通过 / 0 失败');
