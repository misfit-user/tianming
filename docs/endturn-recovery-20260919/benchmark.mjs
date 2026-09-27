import fs from 'node:fs';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),{fixture,pause}=require('../../web/scripts/lib-turn-response-recovery');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function trial(enabled){const f=fixture();let calls=0,proseCalls=0;const outputs=[];try{
  f.c.fetch=async(_url,opts)=>{calls++;await pause(50);const b=JSON.parse(opts.body);
    if(b.messages[1].content==='prose'&&++proseCalls===1)return {ok:false,status:503,headers:{get:()=>null},text:async()=> 'simulated provider outage'};
    return f.okay(f.response(b.messages[1].content==='main'?'完整状态提案与依据。':'完整叙事，不减少人物、因果和事件。'.repeat(80)));
  };
  const make=kind=>{const b=f.body();b.messages[1].content=kind;return b;};
  const start=performance.now();const first=enabled?await f.begin():f.capture();
  try{outputs.push((await f.request(make('main'))).choices[0].message.content);await f.request(make('prose'));}catch(e){f.rollback(first,e);}
  if(enabled)await f.begin();
  const main=(await f.request(make('main'))).choices[0].message.content,narrative=(await f.request(make('prose'))).choices[0].message.content;
  return {calls,ms:Number((performance.now()-start).toFixed(3)),sameMain:outputs[0]===main,mainHash:sha(main),narrativeHash:sha(narrative)};
}finally{f.dispose();}}
const result={description:'Synthetic two-stage failure, 50 ms per HTTP response; control disables response reuse only. Not real API timing.',control:[],recovery:[]};
for(let i=0;i<3;i++){result.control.push(await trial(false));result.recovery.push(await trial(true));}
const median=rows=>rows.map(r=>r.ms).sort((a,b)=>a-b)[1];
result.summary={controlCalls:result.control[0].calls,recoveryCalls:result.recovery[0].calls,controlMedianMs:median(result.control),recoveryMedianMs:median(result.recovery),identicalFullOutputs:result.control.concat(result.recovery).every(r=>r.sameMain&&r.mainHash===result.control[0].mainHash&&r.narrativeHash===result.control[0].narrativeHash)};
fs.writeFileSync('docs/endturn-recovery-20260919/benchmark.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.summary,null,2));
