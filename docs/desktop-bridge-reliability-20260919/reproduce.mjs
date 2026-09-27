import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{fixture,tick}=require('../../web/scripts/lib-desktop-bridge-reliability');
const rows=[];
for(const [label,root]of [['before','.bak-desktop-bridge-reliability-20260919/web'],['after','web']]){
  const f=fixture(path.resolve(root));let settled=false,value;
  f.c.tianming.stageTurnData=()=>new Promise(()=>{});
  f.save().then(v=>{settled=true;value=v;},()=>{settled=true;});await tick();const deadlines=f.fire();await tick();
  rows.push({label,scenario:'stage-never-replies',deadlines,settled,value,canonicalSlots:f.disk.size});
  const g=fixture(path.resolve(root)),marker=g.marker();g.ctx.meta.stagedTurnData=marker;g.receipts.push(marker);
  g.c.tianming.discardTurnData=async()=>{throw Error('simulated desktop disk failure');};
  try{await g.c._endTurn_discardStagedTurnData(g.ctx);}catch(_){}
  rows.push({label,scenario:'discard-rejected',receiptRetained:g.receipts.length===1,stagedMarkerRetained:!!g.ctx.meta.stagedTurnData});
}
fs.writeFileSync('docs/desktop-bridge-reliability-20260919/reproduced.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
