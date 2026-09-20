import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{fixture,tick}=require('../../web/scripts/lib-storage-read-deadlines');
const dir='docs/storage-write-reliability-20260919',base=JSON.parse(fs.readFileSync(dir+'/baseline.json','utf8')),results=[];
for(const [label,root]of [['before',path.resolve(base.backup,'web')],['after',path.resolve('web')]]){
  const f=fixture({holdWrites:true},root);await f.api.open();const state=f.seed();let settled=false,outcome,notified=0;
  const p=f.api.saveManyAtomic(['autosave','slot_0'].map(id=>({id,gameState:state,meta:{turn:4}})),{onCommitted(){notified++;}}).then(v=>{settled=true;outcome=v;},e=>{settled=true;outcome=e.code;});
  await tick();const deadlineEvents=f.fire(60000);await tick();
  results.push({label,scenario:'write-no-terminal-event',deadlineEvents,settledAfterDeadline:settled,outcome:outcome||'pending',notified,partialSlotWritten:f.rows('saves').has('slot_0')});
}
fs.writeFileSync(dir+'/reproduced.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
