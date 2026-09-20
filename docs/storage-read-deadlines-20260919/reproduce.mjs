import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),{fixture,tick}=require('../../web/scripts/lib-storage-read-deadlines');
const results=[];
for(const [label,root] of [['before',path.resolve('.bak-storage-read-deadlines-20260919/web')],['after',path.resolve('web')]]){
  const f=fixture({holdOpen:true},root);let settled=false,error='';
  f.api.open().then(()=>{settled=true;},e=>{settled=true;error=e.code||e.name;});await tick();
  const fired=f.fire(15000);await tick();results.push({label,scenario:'open-never-responds',deadlineEvents:fired,settled,error});
  const g=fixture({holdReads:true},root);g.seed();let readSettled=false,readError='';
  g.api.load('autosave').then(()=>{readSettled=true;},e=>{readSettled=true;readError=e.code||e.name;});await tick();
  const before=JSON.stringify([...g.rows('saves')]);const firedRead=g.fire(30000);await tick();
  results.push({label,scenario:'record-never-responds',deadlineEvents:firedRead,settled:readSettled,error:readError,unchangedRecords:before===JSON.stringify([...g.rows('saves')])});
  const h=fixture({holdOpen:true},root);const pending=h.api.open().catch(()=>null);h.opens[0].block();await pending;h.opens[0].succeed();
  results.push({label,scenario:'blocked-open-late-success',lateConnectionClosed:h.opens[0].database.closes,lateConnectionBecameAvailable:h.api.isAvailable()});
}
fs.writeFileSync('docs/storage-read-deadlines-20260919/reproduced.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
