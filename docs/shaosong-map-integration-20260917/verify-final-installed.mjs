// Read-only verification of the actual installed official source and runtime.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {isDeepStrictEqual as equal} from 'node:util';
const root=path.resolve(process.argv[2]||'.'),work=path.join(root,'docs/shaosong-map-integration-20260917/map-stage');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(work,f),'utf8'));
const file=path.join(root,'scenarios/绍宋·建炎元年八月（官方）.json'),raw=fs.readFileSync(file),s=JSON.parse(raw),before=read('source-before.json'),plan=read('migration-report.json');
const checks=[];function test(name,fn){try{const detail=fn();checks.push({name,passed:true,detail});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}}
const flat=tree=>{const a=[];function walk(n){if(n.children?.length)n.children.forEach(walk);else if(n.populationDetail)a.push(n);}Object.values(tree).forEach(r=>(r.divisions||[]).forEach(walk));return a;};
const old=flat(before.adminHierarchy),now=flat(s.adminHierarchy),bySource=new Map();
for(const n of now){const key=n.mapAccounting?.sourceAccountId;const list=bySource.get(key)||[];list.push(n);bySource.set(key,list);}
test('installed-source-matches-verified-candidate',()=>assert.equal(hash(raw),plan.candidateSha256));
test('official-id-and-original-protagonist',()=>{assert.equal(s.id,before.id);assert.deepEqual(s.playerInfo,before.playerInfo);});
test('only-required-top-level-adaptation',()=>{const allowed=new Set(['map','mapData','adminHierarchy','characters','cities','externalForces','military']);for(const k of Object.keys(before))if(!allowed.has(k))assert.deepEqual(s[k],before[k],k);assert.deepEqual(Object.keys(s),Object.keys(before));});
test('all-original-character-fields-preserved',()=>{assert.equal(s.characters.length,501);before.characters.forEach((c,i)=>{for(const k of Object.keys(c))assert.deepEqual(s.characters[i][k],c[k],c.id+'.'+k);});});
test('all-original-army-fields-preserved',()=>{assert.equal(s.military.initialTroops.length,100);before.military.initialTroops.forEach((a,i)=>{for(const k of Object.keys(a))assert.deepEqual(s.military.initialTroops[i][k],a[k],a.name+'.'+k);});});
test('events-social-offices-treasuries-preserved',()=>{for(const k of ['events','classes','parties','relations','officeTree','guoku','neitang','factions'])assert.deepEqual(s[k],before[k],k);});
test('map-mirror-and-three-tiers',()=>{assert.deepEqual(s.map,s.mapData);assert.equal(s.map.regions.length,566);assert.equal(s.map.circuitRegistry.length,101);});
test('country-names',()=>{for(const [id,name]of Object.entries({fac_song:'大宋',fac_jin:'大金',fac_xixia:'大夏'})){assert.equal(s.factions.find(f=>f.id===id).name,name);assert.equal(s.map.factions[id].label,name);}});
test('account-identity-closure',()=>{assert.equal(old.length,182);assert.equal(bySource.size,182);assert.equal(now.length,596);const ids=new Map(now.map(n=>[n.id,n]));assert.equal(ids.size,596);for(const r of s.map.regions){assert.ok(r.accountingLeafIds.length);for(const id of r.accountingLeafIds)assert.equal(ids.get(id)?.mapRegionId,r.id);}});
const ratios=new Set(['compliance','skimmingRate','autonomy','taxBurden','commerceCoefficient','roadQuality','armyPressure','recruitmentRate']);
const numericRoots=new Set(['populationDetail','publicTreasuryInit']);
const scalarAmounts=new Set(['population','carryingCapacity','troops','militaryRecruits','recruits','levyPool','localMilitaryCost','retainedNet']);
const additive=p=>numericRoots.has(p[0])||(p.length===1&&scalarAmounts.has(p[0]))||(['fiscalDetail','economyBase','armyDetail','militaryDetail'].includes(p[0])&&!ratios.has(p.at(-1)));
let quantityAssertions=0,stateAssertions=0;
function get(n,p){for(const k of p){assert.ok(n&&Object.prototype.hasOwnProperty.call(n,k),'Missing source field '+p.join('.'));n=n[k];}return n;}
test('every-source-account-quantities-and-local-state',()=>{
 for(const original of old){const id=original.id||original.mapRegionId,parts=bySource.get(id);assert.ok(parts?.length,id);
  assert.ok(Math.abs(parts.reduce((v,n)=>v+n.mapAccounting.weight,0)-1)<1e-9,id+' shares');
  function walk(value,p=[]){if(!p.length){for(const [k,v]of Object.entries(value))walk(v,[k]);return;}
   if(['id','name','mapRegionId'].includes(p.join('.')))return;
   if(typeof value==='number'&&additive(p)){const sum=parts.reduce((v,n)=>v+get(n,p),0);assert.ok(Math.abs(sum-value)<1e-4,id+' '+p.join('.')+' '+sum+' != '+value);quantityAssertions++;}
   else if(value&&typeof value==='object'&&!Array.isArray(value)){for(const [k,v]of Object.entries(value))walk(v,p.concat(k));}
   else for(const n of parts){assert.deepEqual(get(n,p),value,id+' '+p.join('.'));stateAssertions++;}
  }walk(original);
 }return {quantityAssertions,stateAssertions};
});
test('all-original-armies-bind-to-existing-map-id',()=>{const ids=new Set(s.map.regions.map(r=>r.id));s.military.initialTroops.forEach(a=>assert.ok(ids.has(a.garrisonRegionId),a.name));});
test('runtime-files-match-tested-snapshots',()=>{for(const row of read('runtime-plan.json'))assert.equal(hash(fs.readFileSync(path.join(root,'web',row.name))),row.after,row.name);});
const uiFile=path.join(work,'installed-ui-third/report.json');let ui;
test('installed-electron-map-tiers',()=>{ui=JSON.parse(fs.readFileSync(uiFile,'utf8'));assert.equal(ui.sourceSha256,hash(raw));assert.equal(ui.complete,true);assert.equal(ui.exitCode,0);for(const c of ui.checks)assert.equal(c.passed,true,c.name);return {world:ui.world,checks:ui.checks.length,ms:ui.elapsedMs};});
const ledgerTotals=Object.fromEntries(['zhizao','kuangchang','yuyao'].map(k=>[k,now.reduce((t,n)=>t+(n.economyBase?.imperialAssets?.[k]||0),0)]));
const result={checkedAt:new Date().toISOString(),sourceSha256:hash(raw),sourceBytes:raw.length,officialMapApplied:true,releaseReady:false,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks,counts:{regions:566,circuits:101,originalAccounts:182,accountingFragments:now.length,characters:s.characters.length,armies:s.military.initialTroops.length,events:s.events.length},sourcePopulation:old.reduce((t,n)=>t+n.populationDetail.mouths,0),mappedPopulation:now.reduce((t,n)=>t+n.populationDetail.mouths,0),imperialAssets:ledgerTotals,unresolvedCharacterLocations:plan.unresolvedLocations?.filter(r=>r.kind==='character').length,notes:['原始角色所在地文字保留；无法唯一定位者不迁往势力中心','按新地域结算的整数舍入与原粗地区可有微小差异','没有执行真实用户存档迁移、联网AI或全系统长局','全仓门禁另有既有失败及资源不足记录，未视为发布通过']};
fs.writeFileSync(path.join(work,'final-installed-verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,checks:result.checks.filter(c=>!c.passed)},null,2));
if(result.failed)process.exitCode=1;
