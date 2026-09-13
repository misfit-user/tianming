'use strict';
// Real runtime UI; disposable world/profile, no player saves or AI requests.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
module.exports=async function({win,check}){
  const js=async s=>{const r=await win.webContents.executeJavaScript(`(async()=>{try{return {ok:true,value:await (${s})};}catch(e){return {ok:false,error:String(e.stack||e)};}})()`,true);if(!r.ok)throw Error(r.error);return r.value;},failures=[];
  const settle=()=>js(`(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  const visible=selector=>js(`(async()=>{const stop=Date.now()+4000;while(Date.now()<stop){const el=document.querySelector(${JSON.stringify(selector)});let ok=!!el&&el.getBoundingClientRect().width>0;for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p);if(s.visibility==='hidden'||Number(s.opacity)<.98)ok=false;}if(ok)return;await new Promise(r=>requestAnimationFrame(r));}throw Error('UI animation did not settle: '+${JSON.stringify(selector)});})()`);
  const screen=async name=>fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),name+'.png'),(await win.webContents.capturePage()).toPNG());
  const test=async(name,fn)=>{try{await check(name,fn);}catch(e){failures.push(name+'\n'+e.stack);}};
  await js(`(async()=>{
    await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,650));TM_Changelog.markRead();TM_Changelog.close();
    P.ai.key='';P.characters=[];P.playerInfo={characterName:'隔离君主'};
    GM={sid:'seven-ui',running:true,turn:2,_campaignId:'seven-c',_timelineId:'seven-t',_capital:'京师',playerInfo:{characterName:'隔离君主',location:'京师'},playerFactionName:'朝廷',vars:{},rels:{},facs:[],evtLog:[],letters:[],edicts:[],memorials:[],chars:[],armies:[],_edictSuggestions:[],_edictTracker:[],
      guoku:{money:100000,grain:1200000,cloth:300000,turnDays:30},neitang:{money:2390000,grain:100000,cloth:270000,turnDays:30},
      regions:[{id:'div_synthetic_yingtian',name:'应天府',population:1510000,households:280000}],fiscal:{regions:{div_synthetic_yingtian:{claimedRevenue:100000,actualRevenue:70000,retainedBudget:10000,remittedToCenter:40000,compliance:.72}}}};
    if(typeof buildIndices==='function')buildIndices();document.getElementById('launch').style.display='none';document.getElementById('bar').style.display='flex';document.getElementById('G').style.display='grid';TMPhase8FormalBridge.refresh();await document.fonts.ready;
    window.__sevenErrors=[];addEventListener('error',e=>__sevenErrors.push(e.message));
  })()`);
  win.show();win.focus();await settle();
  await test('real mouse right-click can reach both treasury cards while a detail is already open',async()=>{
    await js(`renderTopBarVars()`);
    for(const key of ['guoku','neitang','guoku']){
      const point=await js(`(()=>{const el=document.querySelector('.tb-var[data-key="${key}"]'),r=el.getBoundingClientRect(),x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2),hit=document.elementFromPoint(x,y);return{x,y,hit:el===hit||el.contains(hit),cover:hit?.outerHTML.slice(0,200)};})()`);
      assert(point.hit,JSON.stringify(point));
      for(const type of ['mouseDown','mouseUp'])win.webContents.sendInputEvent({type,button:'right',x:point.x,y:point.y,clickCount:1});
      await settle();
      assert.deepEqual(await js(`Array.from(document.querySelectorAll('.var-drawer-overlay.open')).map(e=>e.id)`),[key+'-drawer-ov']);
    }
    await js(`document.querySelectorAll('.var-drawer-overlay.open').forEach(e=>e.classList.remove('open'))`);
  });
  await test('treasury details replace one another, including repeat opening and blank close',async()=>{
    const r=await js(`(()=>{const states=[];for(const key of ['guoku','neitang','guoku','neitang']){_handleBarVarClick(key);states.push(Array.from(document.querySelectorAll('.var-drawer-overlay.open')).map(x=>x.id));}const ov=document.querySelector('.var-drawer-overlay.open');ov.dispatchEvent(new MouseEvent('click',{bubbles:true}));return{states,remaining:document.querySelectorAll('.var-drawer-overlay.open').length};})()`);
    assert.deepEqual(r.states,[['guoku-drawer-ov'],['neitang-drawer-ov'],['guoku-drawer-ov'],['neitang-drawer-ov']]);assert.equal(r.remaining,0);
  });
  await js(`document.querySelectorAll('.var-drawer-overlay.open').forEach(e=>e.classList.remove('open'))`);
  await test('right-clicking topbar targets opens only the latest detail',async()=>{
    const r=await js(`(()=>{renderTopBarVars();const out=[];for(const key of ['guoku','neitang','guoku']){const el=document.querySelector('.bar-var[data-var="'+key+'"]');if(!el)throw Error('missing topbar '+key);const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});el.dispatchEvent(event);out.push({prevented:event.defaultPrevented,ids:Array.from(document.querySelectorAll('.var-drawer-overlay.open')).map(e=>e.id)});}return out;})()`);
    assert(r.every(x=>x.prevented));assert.deepEqual(r.map(x=>x.ids),[['guoku-drawer-ov'],['neitang-drawer-ov'],['guoku-drawer-ov']]);
  });
  await test('fiscal split table displays the current region name without rewriting stable IDs or ledger values',async()=>{
    const r=await js(`(()=>{const before=JSON.stringify(GM.fiscal);openGuokuPanel();const sections=Array.from(document.querySelectorAll('#guoku-body section'));const section=sections.find(e=>e.textContent.includes('央地分账'));return{text:section?.textContent,html:section?.innerHTML,unchanged:JSON.stringify(GM.fiscal)===before};})()`);
    assert.match(r.text,/应天府/);assert(!r.text.includes('div_synthetic_yingtian'));assert(r.unchanged);
  });
  await visible('#guoku-body');await screen('seven-treasury');
  await js(`document.querySelectorAll('.var-drawer-overlay.open').forEach(e=>e.classList.remove('open'))`);
  await test('population quickstats read explicit households and distinguish missing data from a real zero',async()=>{
    const r=await js(`(()=>{const items=[{population:1510000,households:280000},{population:1510000,populationDetail:{households:280000}},{population:{mouths:1510000,households:0}},{population:1510000},{population:0},{population:1510000,registeredHouseholds:'28万户，151万口'},{population:1510000,households:0,registeredHouseholds:'28万户'}];return items.map(d=>{const before=JSON.stringify(d),el=document.createElement('div');el.innerHTML=_peRenderQuickStats(d);return{unit:el.querySelector('.tm-div-qs-sub').textContent,value:el.querySelector('.tm-div-qs-val').textContent,unchanged:before===JSON.stringify(d)};});})()`);
    assert.equal(r[0].unit,'28万户');assert.equal(r[1].unit,'28万户');assert.equal(r[2].unit,'0户');assert.match(r[3].unit,/未载|未知/);assert.match(r[4].unit,/未载|未知/);assert.equal(r[4].value,'0');assert(r.every(x=>x.unchanged));
    assert.equal(r[5].unit,'28万户');assert.equal(r[6].unit,'0户');
  });
  await test('help switches content in place without moving or rebuilding the scrolled topic list',async()=>{
    await js(`openHelp('overview')`);await settle();
    const r=await js(`(()=>{const ov=document.getElementById('help-overlay'),nav=ov.querySelector('.generic-modal').firstElementChild;nav.scrollTop=120;const before=nav.scrollTop,box=nav.getBoundingClientRect(),first=nav.children[2];const focus=first.querySelector('button')||first;if(focus.focus)focus.focus();const rows=[];for(const key of ['apikey','shortcuts','gameplay','overview']){switchHelpTopic(key);const current=document.getElementById('help-overlay'),n=current.querySelector('.generic-modal').firstElementChild,b=n.getBoundingClientRect();rows.push({same:current===ov&&n===nav,scroll:n.scrollTop,before,height:b.height,width:b.width,y:b.y,oldHeight:box.height,oldWidth:box.width,oldY:box.y,count:document.querySelectorAll('#help-overlay').length});}return rows;})()`);
    assert(r.every(x=>x.same&&x.count===1));assert(r.every(x=>x.scroll===x.before));assert(r.every(x=>Math.abs(x.height-x.oldHeight)<1&&Math.abs(x.width-x.oldWidth)<1&&Math.abs(x.y-x.oldY)<1),JSON.stringify(r));
  });
  await visible('#help-overlay');await screen('seven-help');
  await js(`closeHelp()`);
  await test('right-rail second click closes; another button switches and an explicit open remains idempotent',async()=>{
    const r=await js(`(()=>{const b=TMPhase8FormalBridge,states=[];b._closeRightDrawer();const rail=document.querySelector('#tm-right-rail [data-slot="army"]');rail.click();states.push(document.getElementById('rpanel').classList.contains('show'));document.querySelector('#tm-right-rail [data-slot="army"]').click();states.push(document.getElementById('rpanel').classList.contains('show'));document.querySelector('#tm-right-rail [data-slot="finance"]').click();states.push(document.getElementById('rpanel').classList.contains('show'));b.openPanel('finance');states.push(document.getElementById('rpanel').classList.contains('show'));return{states,connected:rail.isConnected};})()`);
    assert.deepEqual(r.states,[true,false,true,true]);assert(r.connected);
  });
  await test('office rail opens its standalone view and second click returns home',async()=>{
    const r=await js(`(()=>{TMPhase8FormalBridge._closeRightDrawer();const states=[];for(let i=0;i<2;i++){document.querySelector('#tm-right-rail [data-slot="archive"]').click();states.push(document.body.classList.contains('tm-phase8-office-single'));}return states;})()`);assert.deepEqual(r,[true,false]);
  });
  await test('deleting edict advice keeps the exact form, drafts, selection and remaining suggestion nodes',async()=>{
    await js(`(()=>{GM._edictSuggestions=[0,1,2].map(i=>({id:'s'+i,source:'隔离御案',text:'建议'+i,turn:i+1}));TMPhase8FormalBridge.drafts.openZhaoPreviewPanel();})()`);await settle();
    const r=await js(`(()=>{const ov=document.getElementById('tm-action-edict-overlay'),field=ov.querySelector('#edict-pol'),list=ov.querySelector('.sug-list'),cards=Array.from(list.children);field.value='诏曰：保留正在撰写的内容 😀';field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();field.setSelectionRange(3,9);field.scrollTop=12;const top=field.scrollTop;TMPhase8FormalBridge.dismissEdictSuggestion(1);return{sameOverlay:ov===document.getElementById('tm-action-edict-overlay'),sameField:field===document.querySelector('#tm-action-edict-overlay #edict-pol'),value:document.querySelector('#tm-action-edict-overlay #edict-pol').value,focused:document.activeElement===field,start:field.selectionStart,end:field.selectionEnd,scroll:field.scrollTop,top,count:document.querySelector('#tm-action-edict-overlay .col-sug-t small').textContent,remaining:cards.filter(c=>c.isConnected).length,used:GM._edictSuggestions.map(x=>!!x.used)};})()`);
    assert(r.sameOverlay&&r.sameField&&r.focused);assert.match(r.value,/保留正在撰写/);assert.equal(r.start,3);assert.equal(r.end,9);assert.equal(r.scroll,r.top);assert.equal(r.count,'2 条');assert.equal(r.remaining,2);assert.deepEqual(r.used,[false,true,false]);
  });
  await test('sequential advice removal targets original indices and reaches an honest empty state',async()=>{
    const r=await js(`(()=>{const ov=document.getElementById('tm-action-edict-overlay'),field=ov.querySelector('#edict-pol');TMPhase8FormalBridge.dismissEdictSuggestion(0);TMPhase8FormalBridge.dismissEdictSuggestion(2);return{same:field===document.querySelector('#tm-action-edict-overlay #edict-pol'),used:GM._edictSuggestions.every(x=>x.used),empty:document.querySelector('#tm-action-edict-overlay .sug-list').textContent,count:document.querySelector('#tm-action-edict-overlay .col-sug-t small').textContent};})()`);assert(r.same&&r.used);assert.match(r.empty,/暂无御案建议/);assert.equal(r.count,'0 条');
  });
  await visible('#tm-action-edict-overlay #edict-pol');await settle();await new Promise(r=>setTimeout(r,300));await screen('seven-edict');
  await test('edict deletion and draft survive the completed opening animation',async()=>{
    const r=await js(`(()=>{const ov=document.getElementById('tm-action-edict-overlay');return{value:ov.querySelector('#edict-pol').value,count:ov.querySelector('.col-sug-t small').textContent,used:GM._edictSuggestions.map(e=>!!e.used)};})()`);assert.match(r.value,/保留正在撰写/);assert.equal(r.count,'0 条');assert(r.used.every(Boolean));
  });
  await require('./seven-api-cases.cjs')({win,check});
  if(failures.length)throw Error(failures.join('\n\n'));
};
