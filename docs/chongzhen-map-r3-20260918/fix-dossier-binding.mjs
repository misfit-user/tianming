// Exact live administrative bindings must outrank the former province's aliases.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import vm from 'node:vm';import {createRequire} from 'node:module';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const file=path.join(root,'web/phase8-formal-map.js'),before=fs.readFileSync(file),eol=before.includes(Buffer.from('\r\n'))?'\r\n':'\n';let t=before.toString('utf8');
function one(a,b){a=a.replace(/\r?\n/g,eol);b=b.replace(/\r?\n/g,eol);assert.equal(t.split(a).length,2,a);t=t.replace(a,b);}
one("    var out = [];\n    [\n      r && r.id,",`    var out = [];
    if (r && r.sourceProvinceId && r.id !== r.sourceProvinceId && Array.isArray(r.accountingLeafIds)) {
      [r.id,r.adminBinding,r.name,data.id,data.name].forEach(function(v){pushUniqueValue(out,v);});
      return out; // A province aggregate is not a fallback for its smaller child account.
    }
    [
      r && r.id,`);
one("    // id 精确匹配优先(region.id ↔ admin node.id)·命中即返回·防同名/别名走偏",`    if (r && r.adminBinding && Array.isArray(r.accountingLeafIds)) {
      var bound = _admIdxCache.map.get(regionKeyNorm(r.adminBinding));
      if (bound && bound.kind === 'id') return bound.node;
    }
    // id 精确匹配优先(region.id ↔ admin node.id)·命中即返回·防同名/别名走偏`);
new vm.Script(t,{filename:'phase8-formal-map.js'});
const require=createRequire(path.join(root,'package.json')),acorn=require('acorn'),ast=acorn.parse(t,{ecmaVersion:'latest'}),names=new Set(['regionKeyNorm','pushUniqueValue','regionNameKeys','regionMatchFields','_provStatsIndex','findLiveProvinceStats','_buildAdminIndex','findLiveAdminDivision']),decls=[];
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&names.has(n.id?.name)){decls.push(t.slice(n.start,n.end));names.delete(n.id.name);}for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}
walk(ast);assert.equal(names.size,0);const code='var _rknCache=new Map(),_provStatsIdxCache={ref:null,turn:-1,map:null},_admIdxCache={gmRoot:null,pRoot:null,turn:-1,map:null};\n'+decls.join('\n');
const s=JSON.parse(fs.readFileSync(path.join(w,'candidate.json'),'utf8')),ctx={GM:{turn:1,adminHierarchy:structuredClone(s.adminHierarchy),provinceStats:{}},P:{}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
const checks=[];function check(name,fn){fn();checks.push({name,passed:true});}
check('every-map-cell-resolves-its-exact-admin-account',()=>{for(const r of s.map.regions){const n=ctx.findLiveAdminDivision(r);assert.equal(n?.id,r.adminBinding,r.name);}});
const r=s.map.regions.find(r=>r.id==='ming-28-p03');
check('jinzhou-population-is-leaf-not-whole-theater',()=>{const n=ctx.findLiveAdminDivision(r);assert.equal(n.populationDetail.mouths,48936);assert.equal(n.populationDetail.ding,12723);});
check('parent-only-province-stats-are-not-child-vitals',()=>{ctx.GM.provinceStats={'ming-28':{population:500000,ding:130000,sourceId:'ming-28',name:'辽东（明·关宁东江）'}};assert.equal(ctx.findLiveProvinceStats(r),null);});
check('exact-child-stats-still-win',()=>{ctx.GM.provinceStats={[r.id]:{population:48000,ding:12500},'ming-28':{population:500000,ding:130000}};assert.equal(ctx.findLiveProvinceStats(r).ding,12500);});
check('readers-do-not-write-live-accounts',()=>{const raw=JSON.stringify(ctx.GM.adminHierarchy);s.map.regions.forEach(row=>ctx.findLiveAdminDivision(row));assert.equal(JSON.stringify(ctx.GM.adminHierarchy),raw);});
const backup=path.join(w,'dossier-renderer-before.js'),staged=path.join(w,'dossier-renderer-after.js');assert.ok(!fs.existsSync(backup),'Existing patch journal needs review');fs.writeFileSync(backup,before);fs.writeFileSync(staged,t);assert.equal(hash(fs.readFileSync(file)),hash(before));
const tmp=file+'.cz-r3-dossier.tmp';assert.ok(!fs.existsSync(tmp));fs.copyFileSync(staged,tmp,fs.constants.COPYFILE_EXCL);
try{fs.renameSync(tmp,file);}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;assert.equal(hash(fs.readFileSync(file)),hash(before));fs.copyFileSync(staged,file);fs.unlinkSync(tmp);}
assert.equal(hash(fs.readFileSync(file)),hash(t));
const report={file:'web/phase8-formal-map.js',before:hash(before),after:hash(t),complete:true,checks,sourceScenarioUnchanged:true};fs.writeFileSync(path.join(w,'dossier-renderer-applied.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
