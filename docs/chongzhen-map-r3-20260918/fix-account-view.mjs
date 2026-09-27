// Verify and apply read-only aggregation for a map cell with several original accounts.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import vm from 'node:vm';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const file=path.join(root,'web/phase8-formal-map-dossier.js');
const raw=fs.readFileSync(file),source=fs.readFileSync(path.join(root,'scenarios/天启七年·九月（官方）.json'));
const fragment=fs.readFileSync(path.join(root,'docs/chongzhen-map-r3-20260918/account-view.fragment.js'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(fragment,ctx);
const s=JSON.parse(source),nodes=new Map();
function walk(n){nodes.set(n.id,n);(n.children||[]).forEach(walk);}
Object.values(s.adminHierarchy).forEach(r=>(r.divisions||[]).forEach(walk));const checks=[];
for(const r of s.map.regions.filter(r=>r.accountingLeafIds.length>1)){
 const n=nodes.get(r.adminBinding),before=JSON.stringify(n),a=ctx.combinedMapAccountView(r,n);assert.ok(a,r.name);
 const pop=r.accountingLeafIds.reduce((sum,id)=>sum+nodes.get(id).populationDetail.mouths,0),ding=r.accountingLeafIds.reduce((sum,id)=>sum+nodes.get(id).populationDetail.ding,0);
 assert.equal(a.population,pop,r.name);assert.equal(a.populationDetail.mouths,pop,r.name);assert.equal(a.populationDetail.ding,ding,r.name);assert.equal(JSON.stringify(n),before,'Read mutated accounts');checks.push({name:r.name,accounts:r.accountingLeafIds.length,population:pop,ding,passed:true});
}
const pidao=s.map.regions.find(r=>r.id==='ming-28-p08'),v=ctx.combinedMapAccountView(pidao,nodes.get(pidao.adminBinding));assert.equal(v.population,170214);assert.ok(v.description.includes('战区分项'));
let text=raw.toString('utf8'),eol=text.includes('\r\n')?'\r\n':'\n';
const anchor='  function regionBundle(r){';assert.equal(text.split(anchor).length,2);text=text.replace(anchor,fragment.replace(/\r?\n/g,eol)+eol+anchor);
const old='    var liveStats = findLiveProvinceStats(r);';assert.equal(text.split(old).length,2);text=text.replace(old,old+eol+'    var combined = combinedMapAccountView(r, liveDivision);'+eol+'    if (combined) { liveDivision=combined; liveStats=null; }');
new vm.Script(text,{filename:'phase8-formal-map-dossier.js'});
fs.writeFileSync(path.join(w,'account-view-before.js'),raw);const staged=path.join(w,'account-view-after.js');fs.writeFileSync(staged,text);assert.equal(hash(fs.readFileSync(file)),hash(raw));
const tmp=file+'.cz-r3-account.tmp';assert.ok(!fs.existsSync(tmp));fs.copyFileSync(staged,tmp,fs.constants.COPYFILE_EXCL);
try{fs.renameSync(tmp,file);}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;assert.equal(hash(fs.readFileSync(file)),hash(raw));fs.copyFileSync(staged,file);fs.unlinkSync(tmp);}
assert.equal(hash(fs.readFileSync(file)),hash(text));assert.equal(hash(fs.readFileSync(path.join(root,'scenarios/天启七年·九月（官方）.json'))),hash(source));
const report={file:'web/phase8-formal-map-dossier.js',before:hash(raw),after:hash(text),sourceSha256:hash(source),complete:true,checks};fs.writeFileSync(path.join(w,'account-view-applied.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
