#!/usr/bin/env node
'use strict';
// smoke-deadcode-bugfix — 减量审计揪出的2个潜在bug:edict重复target键 / content findCatalogPack命名冲突
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8'); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-deadcode-bugfix');

// ══ Bug1: tm-edict-parser keywordMap 重复 target 键 → 合并 ══
const edict = read('tm-edict-parser.js');
const kwStart = edict.indexOf('var keywordMap = {');
const kwBlock = edict.slice(kwStart, edict.indexOf('var filled', kwStart));
const targetCount = (kwBlock.match(/\btarget:\s*\//g) || []).length;
ok(targetCount === 1, '★keywordMap 内 target 键唯一(原重复键已消除·不再 last-wins 覆盖)');
const tm = kwBlock.match(/\btarget:\s*(\/[^\n]+?\/)\s*,/);
ok(tm && tm[1].indexOf('江南') >= 0, '合并后 target 含地理词(江南)');
ok(tm && tm[1].indexOf('逃户') >= 0, '合并后 target 含户籍词(逃户)');
const targetRe = eval(tm[1]); // 自身正则字面量·测试安全
ok(targetRe.test('江南治水') && targetRe.test('清查逃户'), '★合并后 target 正则两类都命中(地名检测复活·原本永不匹配)');

// ══ Bug2: tm-content-manager findCatalogPack 重复定义命名冲突 ══
const cm = read('tm-content-manager.js');
ok(!/function findCatalogPack\(id\)\s*\{/.test(cm), '原单参 findCatalogPack(id) 死定义已不存在');
// 行为级:findCatalogPackById 的 detailPack 兜底复活
const fn = sliceFn(cm, 'function findCatalogPackById(');
function run(state, id){
  const ctx = { String:String, console:console, state:state };
  vm.createContext(ctx);
  vm.runInContext('var state = this.state;\n' + fn + '\nthis.go=findCatalogPackById;', ctx);
  return ctx.go(id);
}
ok(run({ catalog:{ packs:[{id:'p1', n:1}] } }, 'p1').n === 1, '按 id 命中目录 pack');
ok(run({ catalog:{ packs:[] }, detailPack:{ id:'d9', n:9 } }, 'd9').n === 9, '★detailPack 兜底复活(openPackDetail 依赖·原被双参版覆盖而丢失)');
ok(run({ catalog:{ packs:[{id:5, n:5}] } }, '5').n === 5, '宽松 String 比较(数字 id 命中字符串查询)');
ok(run({ catalog:{ packs:[] } }, 'nope') === null, '无匹配返回 null');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
