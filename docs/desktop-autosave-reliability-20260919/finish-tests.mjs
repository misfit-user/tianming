import fs from 'node:fs';import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-desktop-autosave-reliability.js',(s,r)=>r(s,'(async()=>{',`test('world change during JSON encoding prevents the native call',async()=>{
  const f=fixture();Object.defineProperty(f.c.lastCommittedSnapshot.GM,'lateField',{enumerable:true,get(){f.c._tmLoadGen++;return 'fixture';}});
  assert.equal((await f.save()).ok,false);assert.equal(f.calls.length,0);assert.equal(f.status().pending,false);
});
test('the complete close coordinator refuses an unconfirmed native write',async()=>{
  const f=fixture();f.setReply(()=>new Promise(()=>{}));const p=f.save();await tick();f.fire(60000);await p;f.c._autoSaveDeferred=false;
  const out=await f.c._tmFlushBackgroundAutosavesForClose();assert.equal(out.ok,false);assert.equal(out.code,'desktop-autosave-unconfirmed');assert.equal(f.calls.length,1);
});
(async()=>{`));
const file='docs/desktop-autosave-reliability-20260919/verify.mjs';let source=fs.readFileSync(file,'utf8');
const from="p=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'})";
if(source.split(from).length!==2)throw Error('Verifier syntax branch not unique');
source=source.replace(from,"p=file.endsWith('.js')?cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'}):{status:0}");fs.writeFileSync(file,source);
