'use strict';
// Same input, runtime and device. This compares added local capability with the base's missing-key return.
const fs=require('fs'),cp=require('child_process'),os=require('os'),path=require('path'),{performance}=require('perf_hooks');
const root=path.resolve(__dirname,'../..'),{fixture}=require(path.join(root,'web/scripts/lib-npc-action-fixture'));
const base='22472d247e54956238387defaeda1c50db7acd43',cache=new Map();
function source(file){if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',base+':web/'+file],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024}));return cache.get(file);}
function input(before){
 const c=fixture(before?{source}:{});c.P.ai={};c.P.time={daysPerTurn:1};c.GM.turn=1;c.GM.facs=[];c.GM.officeTree=[];delete c.GM.guoku;
 c.GM.mapData={locationBindingContract:{schema:'source-text-location-v2'},regions:[{id:'city',name:'城内'}]};c._getDaysPerTurn=()=>1;c.getCurrentGameDay=()=>c.GM.turn-1;
 const queue=[],batches=[];c.setTimeout=fn=>queue.push(fn);c.apiAttempts=[];
 for(const name of ['callAI','callAIMessages','callAIWithTools','callAISmart','callAIStream','callAIStreamMessages','fetch'])c[name]=()=>{c.apiAttempts.push(name);throw Error('forbidden '+name);};
 for(let n=0;n<6;n++){
  const a='pair-'+n+'a',b='pair-'+n+'b';
  c.actor(a,'请托者'+n,{faction:'',location:'城内',publicIdentity:true,localGoals:[{id:'summary',kind:'assistance',targetId:b,task:{materialRefs:[{kind:'character_public',characterId:a}]}}]});
  c.actor(b,'协助者'+n,{faction:'',location:'城内',publicIdentity:true});
 }
 for(let n=0;n<8;n++)c.actor('z-idle-'+n,'无待办者'+n,{faction:'',location:'城内',publicIdentity:true});
 ['tm-political-actions.js','tm-map-locations.js'].forEach(c.load);
 if(!before)['tm-npc-daily-activities.js','tm-npc-local-ai.js'].forEach(c.load);
 return {c,queue,batches};
}
async function measure(before){
 const {c,queue,batches}=input(before),initialBytes=Buffer.byteLength(JSON.stringify({GM:c.GM,P:c.P})),t=performance.now();
 const r=await c.executeNpcBehaviors({localOnly:true});if(r.local)batches.push(r.local);
 while(queue.length){if(batches.length>8)throw Error('unbounded');queue.shift()();if(c.GM._npcActionState.localDaily)batches.push({...c.GM._npcActionState.localDaily.lastBatch});}
 const elapsedMs=performance.now()-t,plans=c.GM._npcPlans||[],active=plans.filter(p=>!['done','cancelled','rejected','expired'].includes(p.status));
 if(c.apiAttempts.length)throw Error('model attempt');
 return {elapsedMs,people:20,evaluations:batches.reduce((n,b)=>n+(b.processed||0),0),candidates:batches.reduce((n,b)=>n+(b.candidates||0),0),attemptedSteps:batches.reduce((n,b)=>n+(b.decisions||0),0),
 messages:plans.reduce((n,p)=>n+(p.messages||[]).length,0),completedMatters:plans.filter(p=>p.status==='done').length,completedStepReceipts:(c.GM._npcExecutionResults||[]).filter(r=>r.outcome==='completed').length,
 documents:plans.reduce((n,p)=>n+(p.localActivity&&p.localActivity.documents||[]).length,0),activePlans:active.length,maxPendingDays:active.reduce((n,p)=>Math.max(n,c.getCurrentGameDay()-p.localActivity.createdDay),0),
 initialSerializedWorldBytes:initialBytes,serializedWorldBytes:Buffer.byteLength(JSON.stringify({GM:c.GM,P:c.P})),modelAttempts:c.apiAttempts.length,modelInputTokens:0};
}
(async()=>{const result={base,node:process.version,os:os.platform()+' '+os.release(),cpu:os.cpus()[0].model,fixture:'20 people, six independent sourced assistance goals, same explicit city, no key; executeNpcBehaviors(localOnly)',before:[],after:[]};
 for(let n=0;n<7;n++){result.before.push(await measure(true));result.after.push(await measure(false));}
 for(const key of ['before','after']){const sorted=result[key].map(x=>x.elapsedMs).sort((a,b)=>a-b);result[key+'Summary']={...result[key][0],elapsedMs:{min:sorted[0],median:sorted[3],max:sorted[6]}};}
 result.note='Base has no local chooser and produces no ordinary outcomes. Serialized GM/P bytes exclude platform container metadata; browser separately verifies real save/load. No performance multiplier claim.';
 fs.writeFileSync(path.join(__dirname,'PERFORMANCE.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({before:result.beforeSummary,after:result.afterSummary},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
