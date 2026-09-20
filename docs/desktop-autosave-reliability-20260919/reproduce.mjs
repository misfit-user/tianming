import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{fixture,tick}=require('../../web/scripts/lib-desktop-autosave-reliability');
const rows=[];
for(const [label,root]of [['before','.bak-desktop-autosave-reliability-20260919'],['after','.']]){
  {const f=fixture(path.resolve(root));let settled=false;f.setReply(()=>new Promise(()=>{}));f.save().then(()=>settled=true);await tick();const deadlines=f.fire(60000);await tick();rows.push({label,scenario:'native-never-replies',deadlines,settled,inFlight:f.c._autoSaveInFlight,pendingNative:f.status()?.pending??null});}
  {const f=fixture(path.resolve(root));let release;f.setReply(()=>new Promise(r=>release=r));const p=f.api.autoSave({});f.api.rotateAutoSaveSession('new-session-after-load-0002');release({success:true,sessionToken:'autosave-session-fixture-0001'});await p;rows.push({label,scenario:'late-old-success',keptNewSession:f.api.getAutoSaveSessionToken()==='new-session-after-load-0002'});}
  {const f=fixture(path.resolve(root));await f.save();f.c.GM.fullNarrative+='新提交的同回合记忆';f.adopt();const out=await f.c._tmRunDesktopAutoSaveTick();rows.push({label,scenario:'same-turn-new-snapshot',saved:out.ok===true,calls:f.calls.length});}
}
fs.writeFileSync('docs/desktop-autosave-reliability-20260919/reproduced.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
