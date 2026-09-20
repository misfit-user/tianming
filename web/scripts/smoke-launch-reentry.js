'use strict';
const assert=require('assert/strict'),{fixture}=require('./lib-launch-reentry');
const tests=[];const test=(name,fn)=>tests.push({name,fn});
function start(f){f.c.desktopStartProjectScn('one');f.doc.getElementById('start-save-name').value='保留存档名';f.c.desktopConfirmStart();f.c.desktopDoStart();}
test('desktop new-game / exit / new-game can repeat without deleting the mount',async()=>{
 const f=fixture();const host=f.doc.getElementById('main-view');
 for(let i=0;i<5;i++){await f.c.showScnSelect();assert.equal(host.children.length,1);start(f);assert.equal(f.doc.getElementById('main-view'),host);assert.equal(host.children.length,0);assert.equal(f.c.GM.running,true);f.key('Escape');assert(f.doc.getElementById('pause-bg').classList.contains('show'));f.c.closePause();f.c.backToLaunch();assert.equal(f.c.GM.running,true);assert.equal(f.doc.getElementById('G').style.display,'none');await f.c.showScnSelect();assert.equal(host.style.display,'block');assert(host.textContent.includes('完整剧本'));}
 assert.equal(f.calls.starts.length,5);
});
test('previously removed desktop mount is recreated exactly once',async()=>{
 const f=fixture();f.doc.getElementById('main-view').remove();await f.c.showScnSelect();assert.equal(f.doc.querySelectorAll('#main-view').length,1);const host=f.doc.getElementById('main-view');await f.c.showScnSelect();assert.equal(f.doc.getElementById('main-view'),host);assert(host.textContent.includes('完整剧本'));
});
test('ESC never opens in-game pause on title, selector or editor while old world remains',()=>{
 const f=fixture();f.c.GM.running=true;const old=f.c.GM;f.key('Escape');assert.equal(f.calls.settings,1);assert(!f.doc.getElementById('pause-bg').classList.contains('show'));f.c.closeSettings();
 f.doc.getElementById('G').style.display='grid';f.doc.getElementById('launch').style.display='none';f.doc.getElementById('E').style.display='block';f.key('Escape');assert.equal(f.calls.settings,2);assert.equal(f.c.GM,old);
});
test('busy in-game transaction still blocks pause',()=>{
 const f=fixture();f.c.GM.running=true;f.c.GM._endTurnBusy=true;f.doc.getElementById('launch').style.display='none';f.doc.getElementById('G').style.display='grid';f.c.openPause();assert(!f.doc.getElementById('pause-bg').classList.contains('show'));
});
test('pending directory has a visible return path and late success does not reopen it',async()=>{
 const f=fixture();let resolve;f.c.tianming.listScenarios=()=>new Promise(r=>{resolve=r;});const pending=f.c.showScnSelect();await Promise.resolve();await Promise.resolve();assert(f.doc.getElementById('main-view').textContent.includes('正在读取'));f.c.backToLaunch();resolve({success:true,files:[]});await pending;assert.equal(f.doc.getElementById('main-view').style.display,'none');assert.equal(f.hero.style.display,'');
});
test('directory rejection renders recovery controls instead of a blank screen',async()=>{
 const f=fixture();f.c.tianming.listScenarios=async()=>{throw Error('mock IO unavailable');};await f.c.showScnSelect();const host=f.doc.getElementById('main-view');assert.equal(host.style.display,'block');assert(host.textContent.includes('读取失败')&&host.textContent.includes('重试')&&host.textContent.includes('返回'));assert.equal(f.calls.starts.length,0);
});
test('older directory response cannot overwrite a newer selection',async()=>{
 const f=fixture(),pending=[];f.c.tianming.listScenarios=()=>new Promise(r=>pending.push(r));const a=f.c.showScnSelect();await Promise.resolve();await Promise.resolve();const b=f.c.showScnSelect();await Promise.resolve();await Promise.resolve();
 pending[1]({success:true,files:[{id:'new',name:'新目录'}]});await b;const before=f.doc.getElementById('main-view').textContent;pending[0]({success:true,files:[{id:'old',name:'旧目录'}]});await a;assert.equal(f.doc.getElementById('main-view').textContent,before);assert(!before.includes('旧目录'));
});
test('returning invalidates an old opening ceremony and pending start payload',()=>{
 const f=fixture();let closed=0;f.c._tmStartRequestEpoch=7;f.c._tmStartOpeningCleanup=()=>{closed++;};f.c._pendingStartPayload={scn:{id:'stale'}};f.c.backToLaunch();assert.equal(f.c._tmStartRequestEpoch,8);assert.equal(closed,1);assert.equal(f.c._pendingStartPayload,null);assert.equal(f.calls.starts.length,0);
});
test('native start commit is not interrupted by returning to title',()=>{
 const f=fixture();f.c.TM.NativeStart={busy:()=>true,cancel(){throw Error('must not cancel committed start');}};f.doc.getElementById('launch').style.display='none';assert.equal(f.c.backToLaunch(),false);assert.equal(f.doc.getElementById('launch').style.display,'none');
});
(async()=>{let pass=0,fail=0;for(const t of tests)try{await t.fn();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
