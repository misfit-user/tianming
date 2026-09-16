'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({win,root,temp,check,baseline}){
  const js=code=>win.webContents.executeJavaScript(code,true),dir=path.dirname(process.env.TM_BRIDGE_TEST_REPORT),observations=[];
  const settle=()=>js('new Promise(r=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(r)),250))');
  async function click(selector){
    const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing button '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const b=e.getBoundingClientRect(),x=Math.round(b.left+b.width/2),y=Math.round(b.top+b.height/2),hit=document.elementFromPoint(x,y);if(!hit||!e.contains(hit))throw Error('button obscured '+${JSON.stringify(selector)});return{x,y};})()`);
    win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await settle();
  }
  win.show();win.focus();
  await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,600));TM_Changelog.markRead();TM_Changelog.close();window.__startupErrors=[];window.addEventListener('error',e=>__startupErrors.push(String(e.message)));})()`);await settle();
  await click('#btn-new-game');
  await js(`(async()=>{const end=Date.now()+12000;while(!document.querySelector('#main-view .pnl-row button')){if(Date.now()>end)throw Error('scenario list deadline');await new Promise(r=>setTimeout(r,25));}})()`);
  const targetName=process.env.TM_RELIEF_SCENARIO==='sc-tang840-840'?'晚唐':'天启';
  const scenarioSelector=await js(`(()=>{const rows=Array.from(document.querySelectorAll('#main-view .pnl-row'));const row=rows.find(r=>r.textContent.includes(${JSON.stringify(targetName)}));if(!row)throw Error('requested scenario absent');row.setAttribute('data-startup-fixture','chosen');return '[data-startup-fixture="chosen"] button';})()`);
  await click(scenarioSelector);
  await js(`(()=>{const n=document.getElementById('start-save-name');if(!n)throw Error('save name step absent');if(!${baseline})n.value='模式入口隔离验收';n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('#main-view .pnl-ft .bp');
  for(const height of [800,600]){
    win.setSize(1100,height);await settle();
    for(const id of ['mo-yanyi','mo-light','mo-strict']){
      await click('#'+id);
      await js(`document.getElementById('main-view').scrollTop=0`);await settle();
      const r=await js(`(()=>{const e=document.getElementById('start-mode-btn'),b=e?.getBoundingClientRect(),x=b&&b.x+b.width/2,y=b&&b.y+b.height/2,hit=b&&document.elementFromPoint(x,y),anc=[];for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n),r=n.getBoundingClientRect();anc.push({id:n.id,cls:n.className,height:r.height,top:r.top,bottom:r.bottom,client:n.clientHeight,scroll:n.scrollHeight,overflow:s.overflowY,display:s.display});}return{mode:window._pendingStartMode,viewport:[innerWidth,innerHeight],exists:!!e,visible:!!(hit&&e.contains(hit)),button:b&&b.toJSON(),anc,errors:__startupErrors};})()`);
      observations.push(r);fs.writeFileSync(path.join(dir,'startup-mode-observations.json'),JSON.stringify(observations,null,2));fs.writeFileSync(path.join(dir,'mode-'+height+'-'+id+'.png'),(await win.webContents.capturePage()).toPNG());
      if(!baseline)await check('mode '+id+' at '+r.viewport.join('x')+' keeps a visible continuation action',async()=>assert(r.exists&&r.visible,JSON.stringify(r)));
    }
  }
  if(baseline)await check('full native menu reproduces the reported setup surface',async()=>assert(observations.length===6&&observations.every(r=>r.exists)));
  else {
    await js(`(()=>{const ref=document.getElementById('strict-ref-text');ref.value='开成五年正月十四，新君即位。此为隔离入口验收文字。';ref.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('#start-mode-btn');
    await js(`(async()=>{const end=Date.now()+15000;while(!document.getElementById('tm-opening')&&!GM.running){if(Date.now()>end)throw Error('opening continuation deadline: '+__startupErrors.join(';'));await new Promise(r=>setTimeout(r,25));}})()`);
    if(await js(`!!document.getElementById('tm-opening')`)){await click('#tm-op-skip');await click('#tm-op-enter');}
    await js(`(async()=>{await _tmAwaitLoadBarrier();const end=Date.now()+15000;while(!GM.running||GM.turn!==1){if(Date.now()>end)throw Error('actual game did not start');await new Promise(r=>setTimeout(r,25));}await document.fonts.ready;})()`);await settle();
    await check('real setup, start and opening buttons enter the chosen scenario with mode and reference intact',async()=>{
      const r=await js(`(()=>{const s=findScenarioById(GM.sid);return{sid:GM.sid,turn:GM.turn,chars:GM.chars.length,mode:P.conf.gameMode,ref:P.conf.refText,visible:document.getElementById('tmf-formal-map')?.getBoundingClientRect().width>0,policy:s.worldSettings?.historicalOutcomePolicy,errors:__startupErrors};})()`);fs.writeFileSync(path.join(dir,'startup-mode-result.json'),JSON.stringify(r,null,2));assert.equal(r.sid,process.env.TM_RELIEF_SCENARIO||'sc-tianqi7-1627');assert.equal(r.turn,1);assert(r.chars>100&&r.visible);assert.equal(r.mode,'strict_hist');assert(r.ref.includes('隔离入口验收'));assert.deepEqual(r.errors,[]);
    });fs.writeFileSync(path.join(dir,'startup-mode-game.png'),(await win.webContents.capturePage()).toPNG());
  }
};
