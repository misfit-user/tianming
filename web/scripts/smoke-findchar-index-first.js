#!/usr/bin/env node
'use strict';
// smoke-findchar-index-first — findCharByName 索引优先(纯安全提速·行为不变)
//   实跑 findCharByName(canonicalizeCharName 桩计数):
//   ① 精确名命中→不调 canonicalize(省热路径 O(n)) ② 别名(字)miss→回退 canonicalize 解析正确
//   ③ 别名二次查→走缓存 fast-path·不再调 canonicalize ④ 结果对象正确
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-findchar-index-first');

const idx = fs.readFileSync(path.join(ROOT,'tm-indices.js'),'utf8');
const findSrc = sliceFn(idx, 'function findCharByName(');
ok(!!findSrc, 'findCharByName 抽取成功');

const ctx = { canonCalls: 0 };
ctx._tmCleanCharLookupName = function(n){ return (n||'').trim(); };
ctx.canonicalizeCharName = function(raw){ ctx.canonCalls++; return raw === '仲尼' ? '孔丘' : raw; }; // 字 仲尼→孔丘
ctx.buildIndices = function(){};
ctx.window = {};
const charKong = { name:'孔丘', zi:'仲尼' };
const m = new Map(); m.set('孔丘', charKong);
ctx.GM = { _indices: { charByName: m }, chars: [charKong] };
vm.createContext(ctx);
vm.runInContext(findSrc + '\nthis.find = findCharByName;', ctx);

// ① 精确名命中·不调 canonicalize
ok(ctx.find('孔丘') === charKong, '① 精确名 孔丘 命中正确对象');
ok(ctx.canonCalls === 0, '① ★fast-path 命中时零调 canonicalizeCharName(省每次必跑的 O(n))');

// ② 字别名 miss→回退 canonicalize 解析
ok(ctx.find('仲尼') === charKong, '② 字 仲尼 经 canonicalize 解析命中 孔丘');
ok(ctx.canonCalls === 1, '② miss 时回退 canonicalize 一次(别名解析正确性保留)');

// ③ 别名二次查→走缓存 fast-path(首次解析后已 set rawName→char)
const after = ctx.canonCalls;
ok(ctx.find('仲尼') === charKong, '③ 二次查 仲尼 仍命中');
ok(ctx.canonCalls === after, '③ ★二次查 fast-path 命中(首次缓存别名→索引)·不再调 canonicalize');

// ④ 空/空白安全
ok(ctx.find('') === undefined, '④ 空名→undefined(不抛)');
ok(ctx.find('   ') === undefined, '④ 纯空白→undefined');

console.log('\n结果: '+A+' 通过 / 0 失败');
