import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{renderFixture,ROOT,clone}=require('../../web/scripts/lib-save-commit-boundary');
const dir='docs/endturn-commit-reliability-20260919',before=path.resolve('.bak-endturn-commit-reliability-20260919/web');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function trial(root){const f=renderFixture(root);let snapshot;
  f.c.GM.fullNarrative='完整正文与因果说明。'.repeat(1000);f.c.GM.characters=[{name:'甲',history:['原始事件']}];
  const save=f.c.TM_SaveDB.saveManyAtomic;f.c.TM_SaveDB.saveManyAtomic=async(e,o)=>{await save(e,o);await pause(50);f.events.push('cleanup-done');return true;};
  f.c.StateSnapshot.save=async args=>{snapshot=clone(args.canonicalState);f.events.push('snapshot-start');await pause(50);f.events.push('snapshot-done');return {ok:true};};
  const start=performance.now(),ok=await f.save();return {ok,ms:Number((performance.now()-start).toFixed(3)),events:f.events,canonicalHash:sha(f.disk.get('autosave')),snapshotHash:sha(snapshot),sameState:sha(snapshot)===sha(f.disk.get('autosave'))};
}
const result={description:'Synthetic healthy save tail; cleanup and auxiliary snapshot each wait 50 ms. No real API, live save or overall-turn speed measurement.',before:[],after:[]};
for(let i=0;i<3;i++){result.before.push(await trial(before));result.after.push(await trial(ROOT));}
const median=a=>a.map(r=>r.ms).sort((a,b)=>a-b)[1];
result.summary={beforeMedianMs:median(result.before),afterMedianMs:median(result.after),fullStateUnchanged:result.before.concat(result.after).every(r=>r.ok&&r.sameState&&r.canonicalHash===result.before[0].canonicalHash)};
const reproduced=[];
for(const [label,root] of [['before',before],['after',ROOT]]){for(const scenario of ['snapshot-reject','snapshot-switch']){
  const f=renderFixture(root);f.c.StateSnapshot.save=async()=>{if(scenario==='snapshot-reject')throw Error('auxiliary failure');f.c.GM={turn:99};f.c.P={};f.c._tmLoadGen++;return {ok:true};};
  const ok=await f.save();reproduced.push({label,scenario,returned:ok,canonicalSlots:f.disk.size,publishedMarker:f.markers.has('tm_autosave_mark'),warnings:f.ctx.meta.turnSaveWarnings||[]});
}}
fs.writeFileSync(dir+'/benchmark.json',JSON.stringify(result,null,2));fs.writeFileSync(dir+'/reproduced.json',JSON.stringify(reproduced,null,2));
console.log(JSON.stringify(result.summary,null,2));console.log(JSON.stringify(reproduced,null,2));
