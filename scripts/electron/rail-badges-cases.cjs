'use strict';
// Real production main/preload/renderer and DOM clicks with hit tests.
// Synthetic world, no API key, external network blocked by the existing bridge gate.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
module.exports=async function({win,check}){
  const js=async code=>{const r=await win.webContents.executeJavaScript(`(async()=>{try{return {ok:true,value:await (${code})};}catch(e){return {ok:false,error:String(e.stack||e)};}})()`,true);if(!r.ok)throw Error(r.error);return r.value;};
  const settle=()=>js('(async()=>{await new Promise(r=>setTimeout(r,160));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()');
  const click=async selector=>{
    const r=await js(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return {missing:true};b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {hit:t===b||b.contains(t),width:r.width,height:r.height,top:t?.tagName+'#'+t?.id+'.'+t?.className};})()`);
    if(!r.hit)fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'hit-failure.png'),(await win.webContents.capturePage()).toPNG());
    assert(r.hit&&r.width>0&&r.height>0,JSON.stringify({selector,...r}));await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await settle();
  };
  const badge=()=>js(`(()=>{const b=document.querySelector('#tm-right-rail [data-phase8-badge="audience"]');return {text:b?.textContent,hidden:b&&getComputedStyle(b).display==='none',label:b?.parentNode.getAttribute('aria-label')};})()`);
  await js(`(async()=>{window.__railErrors=[];window.addEventListener('error',e=>__railErrors.push(String(e.error?.stack||e.message)));await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,650));TM_Changelog.markRead();TM_Changelog.close();
    P.ai.key='';P.characters=[];P.playerInfo={characterName:'隔离君主'};
    GM={sid:'rail-badge-fixture',turn:2,_campaignId:'rail-c',_timelineId:'rail-t',_capital:'京师',playerInfo:{characterName:'隔离君主',location:'京师'},playerFactionName:'朝廷',vars:{},rels:{},facs:[],evtLog:[],letters:[],edicts:[],memorials:[],_edictSuggestions:[],_edictTracker:[],chars:[
      {id:'a',name:'请见文臣甲',alive:true,age:40,health:90,location:'京师',faction:'朝廷',officialTitle:'主事',stress:80,loyalty:60,ambition:50},
      {id:'b',name:'候见文臣乙',alive:true,age:42,health:90,location:'京师',faction:'朝廷',officialTitle:'侍郎',stress:0,loyalty:60,ambition:50}
    ],_pendingAudiences:[{name:'隔离使节',isEnvoy:true,reason:'陈述来意',_qid:'envoy'},{name:'候见文臣乙',reason:'核报钱粮',_qid:'b'}]};
    if(typeof buildIndices==='function')buildIndices();document.getElementById('launch').style.display='none';document.getElementById('bar').style.display='flex';document.getElementById('G').style.display='grid';TMPhase8FormalBridge.refresh();await document.fonts.ready;})()`);
  win.show();await settle();
  await check('rail-real-audience-count-and-readable-label',async()=>{assert.deepEqual(await badge(),{text:'3',hidden:false,label:'问对与朝议 · 3 人请见待办'});});
  await check('unrelated-record-totals-do-not-create-other-red-badges',async()=>{await js(`(()=>{GM.memorials=Array.from({length:12},(_,i)=>({id:'m'+i,status:'pending'}));GM.currentIssues=Array.from({length:6},()=>({status:'pending'}));TMPhase8FormalBridge._updateRailBadges();})()`);assert.equal(await js(`document.querySelectorAll('#tm-right-rail .tm-rc-count').length`),1);assert.equal((await badge()).text,'3');});
  await check('badge-click-opens-real-requests-not-previous-court-tab',async()=>{
    await js(`(()=>{TMPhase8FormalBridge._state.rightIssueTab='chaoyi';})()`);await click('#tm-right-rail [data-slot="issue"]');
    assert.equal(await js(`TMPhase8FormalBridge._state.rightIssueTab`),'wendui');assert.equal(await js(`document.querySelector('[data-wendui-pending-count]')?.getAttribute('data-wendui-pending-count')`),'3');assert.equal(await js(`document.querySelectorAll('#tm-phase8-formal-panel .tmrp-wd-request').length`),3);assert.equal((await badge()).text,'3');
    fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'audience-pending.png'),(await win.webContents.capturePage()).toPNG());
  });
  // Programmatic data refresh stays idempotent; only a physical rail entry toggles the panel.
  await check('same-person-queue-and-dynamic-request-is-not-double-counted',async()=>{await js(`(()=>{GM._pendingAudiences.push({name:'请见文臣甲',_qid:'a1'});TMPhase8FormalBridge.openPanel('issue');})()`);assert.equal((await badge()).text,'3');assert.equal(await js(`document.querySelectorAll('#tm-phase8-formal-panel [data-right-action="wendui-audience"]').length`),0);await js(`(()=>{_wdRemovePendingAudience('a1');TMPhase8FormalBridge.openPanel('issue');})()`);});
  await check('real-dismiss-click-removes-only-matching-qid-and-decrements',async()=>{await click('[data-right-action="wendui-dismiss"][data-qid="envoy"]');assert.equal((await badge()).text,'2');assert.deepEqual(await js('GM._pendingAudiences.map(q=>q._qid)'),['b']);});
  await check('real-deny-click-hides-current-turn-seeker-without-recording-a-meeting',async()=>{await click('[data-right-action="wendui-deny"][data-id="a"]');assert.equal((await badge()).text,'1');assert.equal(await js(`GM.chars[0]._lastAudienceDeniedTurn===2&&GM.chars[0]._lastMetTurn===undefined`),true);assert.equal(await js(`document.querySelectorAll('#tm-phase8-formal-panel [data-right-action="wendui-audience"]').length`),0);});
  await check('real-queue-click-enters-existing-audience-modal-and-close-clears-last-badge',async()=>{
    // 原 addEB 刷新会回到御案，按真实导航重新进入剩余请见，不点击已关闭抽屉。
    await click('#tm-right-rail [data-slot="issue"]');
    await click('[data-right-action="wendui-queue"][data-qid="b"]');assert.equal(await js(`!!document.getElementById('wendui-modal')&&GM.wenduiTarget==='候见文臣乙'`),true);
    await js(`(async()=>{await new Promise(r=>setTimeout(r,380));})()`);
    await click('#wendui-modal [onclick="closeWenduiModal()"]');assert.equal(await js(`GM.chars[1]._lastMetTurn`),2);assert.equal((await badge()).hidden,true);assert.equal((await badge()).text,'');
  });
  await check('next-turn-may-request-again-and-refresh-is-read-only',async()=>{const r=await js(`(()=>{GM.turn++;const before=JSON.stringify(GM);TMPhase8FormalBridge._updateRailBadges();return before===JSON.stringify(GM);})()`);assert.equal(r,true);assert.equal((await badge()).text,'1');});
  await check('switching-world-at-same-turn-does-not-leak-prior-pending-count',async()=>{await js(`(()=>{GM=Object.assign({},GM,{chars:[],_pendingAudiences:[],_timelineId:'other'});if(typeof buildIndices==='function')buildIndices();TMPhase8FormalBridge.refresh();})()`);assert.equal((await badge()).hidden,true);});
  await check('audience-actions-have-no-uncaught-renderer-errors',async()=>{assert.deepEqual(await js('__railErrors'),[]);});
};
