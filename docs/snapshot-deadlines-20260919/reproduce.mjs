import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),{fixture,tick}=require('../../web/scripts/lib-snapshot-deadlines');
const results=[];
for(const [label,root] of [['before','.bak-snapshot-deadlines-20260919/web'],['after','web']]){
  const f=fixture({holdOpen:true},path.resolve(root));let settled=false;
  const task=f.save().then(r=>{settled=true;return r;});await tick();
  const timers=f.fire(15000);await tick();
  results.push({label,scenario:'open-never-responds',deadlineTimers:timers,settledAfterDeadline:settled});
  if(!settled)f.opens[0].onerror({target:{error:Error('cleanup fixture')}});await task;
  const blocked=fixture({holdOpen:true},path.resolve(root));const pending=blocked.save();await tick();
  blocked.opens[0].onblocked();await pending;blocked.opens[0].succeed();await tick();
  results.push({label,scenario:'blocked-open-late-success',lateConnectionClosed:blocked.opens[0].database.closes});
}
fs.writeFileSync('docs/snapshot-deadlines-20260919/reproduced.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
