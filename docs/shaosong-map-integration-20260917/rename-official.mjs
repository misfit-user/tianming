// Scope: rename three polity labels in the official Shaosong source only.
// No map replacement, gameplay balancing, Git operation or release operation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const mode=process.argv.includes('--apply')?'apply':'check';
const dir=path.join(root,'docs/shaosong-map-integration-20260917');
const relative='scenarios/绍宋·建炎元年八月（官方）.json';
const file=path.join(root,relative);
const expected='0e43d46ba32849b7df2b14da99470f059286976f06a482547fcc9057255bd1c7';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const raw=fs.readFileSync(file), text=raw.toString('utf8'), source=JSON.parse(text);
assert.equal(source.id,'sc-jianyan1-1127-shaosong');
assert.equal(hash(raw),expected,'Source changed: stop and review; never overwrite newer work.');
const aliases=new Map([['宋朝廷','大宋'],['宋','大宋'],['金国（大金）','大金'],['金国(大金)','大金'],['金国','大金'],['金','大金'],['西夏','大夏'],['西夏国','大夏']]);
const byId={fac_song:'大宋',fac_jin:'大金',fac_xixia:'大夏'};
const fields=new Set(['faction','factionName','ownerName','scenarioFactionName','fromFaction','toFaction','_latentFaction','enemy']);
const arrayFields=new Set(['linkedFactions','naturalAllies','naturalEnemies','allies','enemies']);
const edits=[];
let pos=0;
const ws=()=>{while(/\s/.test(text[pos]||'')&&pos<text.length)pos++;};
function readString(){const start=pos++;while(pos<text.length){const ch=text[pos++];if(ch==='\\')pos++;else if(ch==='"')return {start,end:pos,value:JSON.parse(text.slice(start,pos))};}throw Error('Unclosed JSON string');}
function proposed(p,value,isKey){
 if(!aliases.has(value))return null;
 const k=p.at(-1), parent=p.at(-2);
 if(isKey)return p[0]==='factions'&&parent==='relations'?aliases.get(value):null;
 if(fields.has(k)||arrayFields.has(parent))return aliases.get(value);
 if(p[0]==='factions'&&p.length===3&&k==='name')return byId[source.factions[p[1]].id]||null;
 if(p[0]==='externalForces'&&p.length===3&&k==='name')return aliases.get(value);
 if(p.join('.')==='adminHierarchy.fac_xixia.divisions.0.name')return '大夏';
 if((p[0]==='map'||p[0]==='mapData')&&p[1]==='factions'&&byId[p[2]]&&['label','short','scenarioFactionName'].includes(k))return byId[p[2]];
 return null;
}
function consider(token,p,isKey=false){const to=proposed(p,token.value,isKey);if(to&&to!==token.value)edits.push({...token,path:p,isKey,to});}
function value(p=[]){
 ws();const ch=text[pos];
 if(ch==='"'){consider(readString(),p);return;}
 if(ch==='{'){
  pos++;ws();if(text[pos]==='}'){pos++;return;}
  while(true){ws();assert.equal(text[pos],'"');const key=readString();consider(key,p.concat(key.value),true);ws();assert.equal(text[pos++],':');value(p.concat(key.value));ws();const sep=text[pos++];if(sep==='}')return;assert.equal(sep,',');}
 }
 if(ch==='['){pos++;ws();if(text[pos]===']'){pos++;return;}let i=0;while(true){value(p.concat(i++));ws();const sep=text[pos++];if(sep===']')return;assert.equal(sep,',');}}
 const start=pos;while(pos<text.length&&!/[\s,\]}]/.test(text[pos]))pos++;assert.ok(pos>start,'Invalid JSON token');
}
value();ws();assert.equal(pos,text.length);
assert.ok(edits.length>0);edits.sort((a,b)=>a.start-b.start);
let last=0,parts=[];for(const e of edits){assert.ok(e.start>=last);parts.push(text.slice(last,e.start),JSON.stringify(e.to));last=e.end;}parts.push(text.slice(last));
const candidateText=parts.join(''), candidate=JSON.parse(candidateText);
const candidateHash=hash(Buffer.from(candidateText,'utf8'));
for(const [id,name]of Object.entries(byId))assert.equal(candidate.factions.find(f=>f.id===id).name,name);
assert.equal(candidate.playerInfo.factionName,'大宋');
assert.deepEqual(candidate.characters.map(c=>c.id),source.characters.map(c=>c.id));
assert.equal(candidate.playerInfo.characterName,source.playerInfo.characterName);
for(const key of ['opening','openingText','background','overview','guoku','neitang','variables'])assert.deepEqual(candidate[key],source[key],key+' changed');
function numeric(v,p=[],out=[]){if(typeof v==='number')out.push([p.join('.'),v]);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))numeric(x,p.concat(k),out);return out;}
assert.deepEqual(numeric(candidate).map(x=>x[1]),numeric(source).map(x=>x[1]),'Numeric/gameplay state changed');
const membership=await import('node:vm');
const context={GM:{facs:structuredClone(candidate.factions)},TM:{},console};context.window=context;
membership.runInNewContext(fs.readFileSync(path.join(root,'web/tm-faction-membership.js'),'utf8'),context);
let nativeResolved=0;
for(const row of [...candidate.characters,...candidate.military.initialTroops]){
 if(!Object.values(byId).includes(row.faction))continue;
 const got=context.TM.FactionMembership.resolveFaction(structuredClone(row));
 assert.ok(got&&got.name===row.faction,'Native faction resolution failed: '+row.name);nativeResolved++;
}
const generator=(await import(pathToFileURL(path.join(root,'web/scripts/sync-official-scenarios.js')))).default;
const planned=generator.buildArtifacts();
const report={stage:'polity-labels-only',newMapApplied:false,source:relative,beforeSha256:hash(raw),afterSha256:candidateHash,changedStringTokens:edits.length,nativeResolved,edits:edits.map(({path,from,value,to,isKey})=>({path,from:value,to,isKey})),preexistingStaleArtifacts:[],written:[]};
for(const[p,v]of planned.files){const old=fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;if(old!==v)report.preexistingStaleArtifacts.push(path.relative(root,p));}
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'candidate-country-labels.json'),candidateText);
fs.writeFileSync(path.join(dir,'rename-check.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({mode,changedStringTokens:edits.length,nativeResolved,beforeSha256:hash(raw),afterSha256:candidateHash,preexistingStaleArtifacts:report.preexistingStaleArtifacts,newMapApplied:false},null,2));
if(mode==='apply'){
 const backup=path.join(dir,'backup');assert.ok(!fs.existsSync(backup),'Backup already exists: review before retry.');
 const targets=[file,...planned.files.keys()];
 const snapshots=targets.map(p=>({path:p,exists:fs.existsSync(p),bytes:fs.existsSync(p)?fs.readFileSync(p):null}));
 for(const row of snapshots){const rel=path.relative(root,row.path);assert.ok(!rel.startsWith('..'));if(row.exists){const b=path.join(backup,rel);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,row.bytes);}}
 fs.writeFileSync(path.join(dir,'backup-manifest.json'),JSON.stringify(snapshots.map(r=>({path:path.relative(root,r.path),exists:r.exists,sha256:r.exists?hash(r.bytes):null})),null,2));
 assert.equal(hash(fs.readFileSync(file)),expected,'Source changed during preparation; abort.');
 const temp=file+'.shaosong-labels.tmp';assert.ok(!fs.existsSync(temp),'Temporary file already exists.');
 const fd=fs.openSync(temp,'wx');try{fs.writeFileSync(fd,candidateText,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 try{
  fs.renameSync(temp,file);assert.equal(hash(fs.readFileSync(file)),candidateHash);
  generator.sync({check:false});generator.sync({check:true});
  for(const row of snapshots){const now=fs.existsSync(row.path)?fs.readFileSync(row.path):null;if(!row.bytes||!now||!row.bytes.equals(now))report.written.push(path.relative(root,row.path));}
  const readback=JSON.parse(fs.readFileSync(file,'utf8'));assert.deepEqual(readback,candidate);
  report.applied=true;report.newMapApplied=false;
  fs.writeFileSync(path.join(dir,'rename-applied.json'),JSON.stringify(report,null,2));
  console.log('APPLIED_POLITY_LABELS_ONLY '+candidateHash);
 }catch(error){
  report.error=String(error&&error.stack||error);report.applied=false;
  fs.writeFileSync(path.join(dir,'rename-apply-error.json'),JSON.stringify(report,null,2));
  throw error; // Keep backups; never blindly overwrite concurrent edits during recovery.
 }
}
