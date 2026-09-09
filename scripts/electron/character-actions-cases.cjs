'use strict';
// Real production UI/entry functions, isolated synthetic world and network denial.
// DOM button.click + hit testing, not native mouse or real AI-provider evidence.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
module.exports=async function({win,check}){
  const js=s=>win.webContents.executeJavaScript(s,true),dir=path.dirname(process.env.TM_BRIDGE_TEST_REPORT);
  await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,650));TM_Changelog.markRead();TM_Changelog.close();
    P.playerInfo={characterName:'隔离君主'};P.characters=[];
    GM={sid:'character-actions-fixture',turn:2,_campaignId:'char-c',_timelineId:'char-t',_capital:'临安',playerInfo:{characterName:'隔离君主',location:'临安'},vars:{},rels:{},facs:[],letters:[],edicts:[],_edictSuggestions:[],_edictTracker:[],chars:[
      {id:'a',name:'文臣甲',alive:true,age:40,health:90,location:'临安',officialTitle:'旧署主事',administration:88,intelligence:70,management:90,military:20,valor:30,charisma:50,diplomacy:40,wuchangOverride:{仁:80,义:90,礼:75,智:65,信:95}},
      {id:'b',name:'武臣乙',alive:true,age:38,health:90,location:'千里外的江陵',administration:20,intelligence:50,management:35,military:90,valor:85,loyalty:65,wuchangOverride:{仁:40,义:90,礼:50,智:80,信:75}}
    ],officeTree:[{name:'财赋署',positions:[{id:'finance',name:'财赋长官',holder:'武臣乙',rank:'正五品',powers:{taxCollect:true}}],subs:[{name:'营造署',positions:[{id:'works',name:'营造主事',headCount:3,actualCount:2,powers:{works:true}}]}]},{name:'军务署',positions:[{id:'military',name:'都尉',holder:'',powers:{militaryCommand:true}}]},{name:'旧署',positions:[{name:'旧署主事',holder:'文臣甲'}]}]};
    if(typeof buildIndices==='function')buildIndices();
    TMPhase8FormalBridge._state.letterDraft={to:'旧收信人',body:'保留已有草稿 é 😀',type:'personal'};
    TMPhase8FormalBridge._state.letterMultiMode=true;
    document.body.classList.add('tm-phase8-formal');openCharRenwuPage('文臣甲');await document.fonts.ready;})()`);
  win.show();
  const settle=()=>js(`(async()=>{const p=document.getElementById('tm-zhi-overlay');if(p)await Promise.all(p.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  const open=async(name='文臣甲')=>{await js(`openCharRenwuPage(${JSON.stringify(name)});`);await settle();};
  const click=async(selector)=>{
    const result=await js(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return{missing:true};b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{hit:t===b||b.contains(t),width:r.width,height:r.height};})()`);
    assert(result.hit&&result.width>0&&result.height>0,JSON.stringify({selector,...result}));
    await js(`document.querySelector(${JSON.stringify(selector)}).click();`);await settle();
  };
  const folio=action=>'#tm-zhi-folio [data-zhi-action="'+action+'"]';
  await check('character-unique-audience-and-letter-in-both-action-groups',async()=>{
    for(const name of ['文臣甲','武臣乙']){await open(name);const r=await js(`['#tm-zhi-folio .actgrid','.dh-acts'].map(s=>{const bs=[...document.querySelector(s).querySelectorAll('button')];return{letter:bs.filter(b=>b.textContent==='鸿雁传书').length,audience:bs.filter(b=>b.textContent==='召入问对').length};})`);assert.deepEqual(r,[{letter:1,audience:1},{letter:1,audience:1}]);}
  });
  await check('character-letter-opens-visible-formal-composer-with-selected-person-and-draft',async()=>{
    await open();await click(folio('letter'));const r=await js(`(()=>{const p=document.getElementById('tm-action-letter-overlay'),s=TMPhase8FormalBridge._state;return{open:!!p,hidden:document.getElementById('tm-zhi-overlay').style.display==='none',to:p?.querySelector('[data-desk-letter-to]')?.value,body:p?.querySelector('[data-desk-letter-body]')?.value,multi:s.letterMultiMode,sent:GM.letters.length};})()`);
    assert.deepEqual(r,{open:true,hidden:true,to:'文臣甲',body:'保留已有草稿 é 😀',multi:false,sent:0});
    await js(`TMPhase8FormalBridge.drafts.closeDeskOverlay();`);
  });
  await check('character-audience-reaches-real-mode-picker',async()=>{await open('武臣乙');await click(folio('wendui'));assert.equal(await js(`document.getElementById('wd-pick-modal')?.querySelector('.wdp-pick-name').textContent.includes('武臣乙')`),true);});
  await check('away-audience-preserves-location-gate-and-routes-to-visible-letter',async()=>{
    await click('#wd-pick-modal .wdp-pick-btn.primary');assert.equal(await js(`!document.getElementById('wendui-modal')&&document.querySelector('#tm-action-letter-overlay [data-desk-letter-to]')?.value==='武臣乙'`),true);
    await js(`TMPhase8FormalBridge.drafts.closeDeskOverlay();`);
  });
  await check('pin-button-has-visible-toggle-and-no-world-write',async()=>{await open();const before=await js('JSON.stringify(GM)');await click(folio('pin'));assert.equal(await js(`document.querySelector('#tm-zhi-folio [data-zhi-action="pin"]').getAttribute('aria-pressed')`),'true');assert.equal(await js('JSON.stringify(GM)'),before);await click(folio('pin'));assert.equal(await js(`document.querySelector('#tm-zhi-folio [data-zhi-action="pin"]').textContent`),'钉选');});
  await check('relations-button-leaves-compare-and-reveals-relations',async()=>{await open();await js(`TMZhi.setCompare('武臣乙');document.getElementById('tm-zhi-main').scrollTop=900;`);await click(folio('relations'));assert.equal(await js(`(()=>{const p=document.getElementById('tm-zhi-main'),d=p.querySelector('.detail'),r=d.getBoundingClientRect(),box=p.getBoundingClientRect();return p.innerHTML.includes('关 系 强 弱')&&r.top>=box.top&&r.top<box.bottom;})()`),true);});
  await check('office-recommendation-default-all-is-read-only-and-sorted',async()=>{
    await open();const before=await js('JSON.stringify(GM)');await click(folio('office'));
    assert.equal(await js(`document.querySelectorAll('#tm-zhi-main [data-zhi-office-index]').length`),4);
    assert.equal(await js(`document.querySelector('[data-zhi-vacant-only]').checked`),false);
    assert.equal(await js('JSON.stringify(GM)'),before);
    fs.writeFileSync(path.join(dir,'office-all.png'),(await win.webContents.capturePage()).toPNG());
  });
  await check('vacancy-checkbox-includes-partial-seat-and-hides-filled-seat',async()=>{
    await click('[data-zhi-vacant-only]');const r=await js(`(()=>{const p=document.getElementById('tm-zhi-main');return{count:p.querySelectorAll('[data-zhi-office-index]').length,partial:p.textContent.includes('营造主事'),filled:p.textContent.includes('财赋长官')};})()`);assert.deepEqual(r,{count:2,partial:true,filled:false});
    fs.writeFileSync(path.join(dir,'office-vacancies.png'),(await win.webContents.capturePage()).toPNG());
  });
  await check('office-action-hands-off-to-existing-picker-filtered-to-person',async()=>{
    await click('[data-zhi-office-pick="0"]');assert.equal(await js(`!!document.getElementById('off-picker-modal')&&document.getElementById('off-picker-search').value==='文臣甲'&&document.getElementById('tm-zhi-overlay').style.display==='none'`),true);
    assert.equal(await js(`GM.chars[0].officialTitle`),'旧署主事');
  });
  await check('existing-resign-concurrent-choice-is-visible-not-under-new-overlay',async()=>{
    await click('#off-picker-modal [onclick^="_offPickerConfirmPre"]');
    const r=await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes("'concurrent'"));if(!b)return false;const r=b.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return t===b||b.contains(t);})()`);assert.equal(r,true);
    fs.writeFileSync(path.join(dir,'office-confirmation.png'),(await win.webContents.capturePage()).toPNG());
    assert.equal(await js(`GM.chars[0].officialTitle`),'旧署主事');
  });
};
