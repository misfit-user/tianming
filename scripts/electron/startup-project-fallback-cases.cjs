'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=async function({win,temp,controls,check}){
 const js=s=>win.webContents.executeJavaScript(s,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(expression){const end=Date.now()+20000;while(!await js(expression)){if(Date.now()>end)throw Error('startup condition did not settle');await wait(25);}}
 async function reload(){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('renderer reload timed out')),20000);win.webContents.once('did-finish-load',()=>{clearTimeout(timer);resolve();});win.webContents.reloadIgnoringCache();});}
 await until('typeof TM_SaveDB!=="undefined"');await wait(300);
 await js(`(async()=>{
   const project={scenarios:[{id:'fixture-primary',name:'primary'}],characters:[],ai:{},conf:{startupProbe:'primary'}};
   localStorage.setItem('tm_api',JSON.stringify({key:'fixture-local-key',url:'fixture-url',model:'fixture-model'}));
   await TM_SaveDB.saveProject(project);
 })()`);
 const backup={scenarios:[{id:'fixture-backup',name:'backup'}],ai:{},conf:{startupProbe:'backup'},gameState:{running:true,turn:77,payload:'x'.repeat(24*1024*1024)}};
 const file=path.join(temp,'saves/__autosave__.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(backup));
 const digest=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),original=digest();
 let count=controls.startupAutoSaveReads||0;
 await check('healthy startup restores the primary project without any desktop backup IPC',async()=>{
   await reload();await until("P.conf&&P.conf.startupProbe==='primary'");await wait(400);
   assert.equal(controls.startupAutoSaveReads||0,count);
   const state=await js(`({running:GM.running,keyPreserved:P.ai.key==='fixture-local-key',scenarios:P.scenarios.map(s=>s.id)})`);
   assert.equal(state.running,false);assert.equal(state.keyPreserved,true);assert(state.scenarios.includes('fixture-primary'));assert.equal(digest(),original);
 });
 await check('missing primary project uses one desktop fallback without loading its running game',async()=>{
   await js('TM_SaveDB.saveProject(null)');count=controls.startupAutoSaveReads||0;await reload();await until("P.conf&&P.conf.startupProbe==='backup'");await wait(300);
   assert.equal((controls.startupAutoSaveReads||0)-count,1);
   assert.deepEqual(await js(`({running:GM.running,keyPreserved:P.ai.key==='fixture-local-key',gameStateLeaked:Object.prototype.hasOwnProperty.call(P,'gameState')})`),{running:false,keyPreserved:true,gameStateLeaked:false});
   assert.equal(digest(),original);
 });
 await check('manual desktop recovery still receives the complete validated game payload',async()=>{
   const payload=await js(`tianming.loadAutoSave().then(r=>({success:r.success,running:r.data?.gameState?.running,turn:r.data?.gameState?.turn,size:r.data?.gameState?.payload?.length}))`);
   assert.deepEqual(payload,{success:true,running:true,turn:77,size:24*1024*1024});assert.equal(digest(),original);
 });
};
