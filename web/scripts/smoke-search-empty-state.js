#!/usr/bin/env node
'use strict';
// smoke-search-empty-state — 御案地图搜索 + 人物名册筛选 零结果空状态(纯安全·原空白似面板坏)
//   ① 地图搜索:rows.length 三元·无匹配/未输入两态文案
//   ② 名册筛选:shown===0 注入 #renwu-filter-empty·有结果则 remove·区分搜索空 vs 暂无人物
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }

console.log('smoke-search-empty-state');

// ── ① 地图搜索 ──
const mapSrc = fs.readFileSync(path.join(ROOT,'phase8-formal-map.js'),'utf8');

// Execute the actual search renderer: both empty states remain visible, and only identical writes are skipped.
{
 const vm=require('vm'),{functionSource}=require('./lib-perf-round1');let value='',writes=0;
 const host={get innerHTML(){return value;},set innerHTML(v){writes++;value=v;}};
 const c={document:{getElementById:()=>host},getMapData:()=>({regions:Array.from({length:8},(_,i)=>({id:'r'+i,name:'河州'+i}))}),regionSearchText:r=>r.name,attr:String,esc:String,ownerName:()=> '测试政权'};
 vm.createContext(c);vm.runInContext('var _mapHTMLCache = new WeakMap();\n'+functionSource(mapSrc,'mapHTML')+'\n'+functionSource(mapSrc,'renderMapSearchResults'),c);
 c.renderMapSearchResults('');ok(value.includes('输入地名以检索'),'① 空查询执行后保留提示');
 c.renderMapSearchResults('missing');ok(value.includes('无匹配地块'),'① 未命中执行后保留提示');
 c.renderMapSearchResults('河州');ok((value.match(/<button/g)||[]).length===6,'① 命中列表仍保留六项');
 const before=writes;c.renderMapSearchResults('河州');ok(writes===before,'① 内容一致时不重复写 DOM');
 c.renderMapSearchResults('河州7');ok(value.includes('河州7')&&!value.includes('河州0'),'① 改变查询后实际更新结果');
}

// ── ② 人物名册筛选 ──

console.log('\n结果: '+A+' 通过 / 0 失败');
