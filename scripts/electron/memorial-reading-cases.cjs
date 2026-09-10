'use strict';
// Real shared UI/main/preload, isolated data, controlled Electron input events.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
module.exports = async function({ win, check }) {
  const out = path.dirname(process.env.TM_BRIDGE_TEST_REPORT), failures = [], observations = [];
  const js = code => win.webContents.executeJavaScript(code, true);
  const verify = async (name, fn) => { try { await check(name, fn); } catch (e) { failures.push({ name, error: String(e.stack || e) }); } };
  const wait = expression => js(`(async()=>{const end=performance.now()+3000;while(!(${expression})){if(performance.now()>end)throw Error('UI condition timed out');await new Promise(r=>requestAnimationFrame(r));}})()`);
  const frame = () => js('(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()');
  win.setSize(1600, 900); win.show();
  await js(`(async()=>{
    await TM_Changelog.getUnreadCount(); await new Promise(r=>setTimeout(r,650)); TM_Changelog.markRead();TM_Changelog.close();
    GM={sid:'memorial-reading-fixture',turn:2,_campaignId:'mr-c',_timelineId:'mr-t',chars:[{name:'测试臣工',loyalty:72,officialTitle:'测试官职'}],facs:[],rels:{},vars:{},edicts:[],memorials:[]};
    for(let i=0;i<40;i++)GM.memorials.push({id:'reading-'+i,turn:2,status:i===38?'held':'pending',subtype:i===35?'密折':'',type:'民生',from:'测试臣工',dept:'测试部门',title:'测试奏疏 '+i,content:('隔离测试奏疏正文 '+i+'。').repeat(24)});
    document.body.classList.add('tm-phase8-formal');TMThemeFont.applySize('md',null,true);TMThemeFont.applyScopeSize('memorial','md');
    TMPhase8FormalBridge.drafts.openYueZouPreviewPanel();await document.fonts.ready;
    window.__mrInitialOverlay=document.querySelector('#tm-action-memorial-overlay');window.__mrShelf=document.querySelector('.zou-yuan .shelf-scroll');
  })()`);
  await frame();
  const snapshot = () => js(`(()=>{const p=document.querySelector('.zou-yuan');return{active:p.querySelector('.zou-folder.active')?.dataset.id,title:p.querySelector('.bh-title')?.textContent,top:p.querySelector('.shelf-scroll').scrollTop,sameShelf:p.querySelector('.shelf-scroll')===__mrShelf,sameOverlay:p.closest('.tm-desk-overlay')===__mrInitialOverlay}})()`);
  const click = async selector => {
    const point = await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing UI control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);if(!hit||!(e===hit||e.contains(hit)))throw Error('UI control is obscured');return{x:Math.round(x),y:Math.round(y)}})()`);
    for (const type of ['mouseMove','mouseDown','mouseUp']) win.webContents.sendInputEvent({ type, ...point, button:'left', clickCount:1 });
    await frame();
  };
  const select = async id => {
    const selector = '.zou-folder[data-id="' + id + '"]';
    await js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    const before = await snapshot(); await click(selector);
    await wait(`document.querySelector('.zou-folder.active')?.dataset.id===${JSON.stringify(id)}`);
    const after = await snapshot(); observations.push({ id, before, after }); return { before, after };
  };
  await verify('lower memorial selection retains exact list node, scroll and correct reader', async () => {
    const {before,after}=await select('reading-30');assert(before.top>1000);assert.equal(after.active,'reading-30');assert(after.title.includes('30'));
    assert.equal(after.top,before.top);assert(after.sameShelf&&after.sameOverlay);
  });
  await verify('typed and programmatically inserted replies survive selection without submission', async () => {
    await js(`(()=>{const t=document.querySelector('[data-desk-memorial-reply]');t.value='待核查的朱批草稿';t.dispatchEvent(new Event('input',{bubbles:true}));t.value+='（尚未触发input的快捷插入）';})()`);
    await select('reading-31');await select('reading-30');
    assert.equal(await js(`document.querySelector('[data-desk-memorial-reply]').value`),'待核查的朱批草稿（尚未触发input的快捷插入）');
    assert.equal(await js(`GM.memorials[30].status`),'pending');
  });
  await verify('reselecting current memorial preserves expanded text and reader scroll', async () => {
    await js(`(()=>{const b=document.querySelector('.ben-text');b.classList.remove('collapsed');window.__mrText=b;document.querySelector('.ben-body').scrollTop=70;window.__mrReaderTop=document.querySelector('.ben-body').scrollTop;})()`);
    await select('reading-30');
    assert.equal(await js(`document.querySelector('.ben-text')===__mrText&&!__mrText.classList.contains('collapsed')&&document.querySelector('.ben-body').scrollTop===__mrReaderTop`),true);
  });
  await verify('secret unseal updates reader without recreating the list', async () => {
    await select('reading-35');assert.equal(await js(`!!document.querySelector('.ben-sealed')`),true);const before=await snapshot();
    await click('[data-desk-action="memorial-unseal-desk"]');await wait(`!!document.querySelector('.ben-text')`);const after=await snapshot();
    assert.equal(after.top,before.top);assert(after.sameShelf);assert.equal(after.active,'reading-35');
  });
  await verify('filtering and closing preserve reply draft and use existing channel', async () => {
    await click('[data-desk-action="memorial-filter-desk"][data-filter="held"]');await wait(`document.querySelector('.zou-folder.active')?.dataset.id==='reading-38'`);
    assert.equal(await js(`document.querySelectorAll('.zou-folder').length`),1);
    await click('[data-desk-action="memorial-filter-desk"][data-filter="all"]');await select('reading-30');
    await js(`TMPhase8FormalBridge.drafts.closeDeskOverlay();TMPhase8FormalBridge.drafts.openYueZouPreviewPanel()`);
    assert.equal(await js(`document.querySelector('[data-desk-memorial-reply]').value`),'待核查的朱批草稿（尚未触发input的快捷插入）');
    assert.equal(await js(`GM.memorials[30].status`),'pending');
  });
  const fonts = () => js(`['.zf-title','.ben-text','.pizhu-ta','.aside .piaoni','.aside .chain-row p'].map(s=>parseFloat(getComputedStyle(document.querySelector('.zou-yuan '+s)).fontSize))`);
  // CSS variable changes must be checked on a displayed frame, not an IPC timing
  // accident. Keep immediate samples to expose (rather than hide) deferred paint.
  const fontTokens = () => js(`(()=>{const p=getComputedStyle(document.querySelector('.zou-yuan')),r=getComputedStyle(document.documentElement);return{scope:p.getPropertyValue('--tm-size-memorial'),global:r.getPropertyValue('--tm-font-global-scale'),ink:r.getPropertyValue('--tm-memorial-ink')}})()`);
  await verify('per-memorial size changes all three columns and reply without flattening hierarchy', async () => {
    await js(`TMThemeFont.applySize('md',null,true);TMThemeFont.applyScopeSize('memorial','md')`);await frame();const before=await fonts();
    await js(`TMThemeFont.applyScopeSize('memorial','xl')`);const immediate=await fonts();await frame();const after=await fonts();observations.push({fontsBefore:before,scopedImmediate:immediate,scopedXL:after,tokens:await fontTokens()});
    before.forEach((n,i)=>assert(Math.abs(after[i]/n-1.3)<0.015));assert(after[1]>after[0]);
  });
  await verify('global and scoped font scaling compose once and default restores original sizes', async () => {
    const before=await fonts();await js(`TMThemeFont.applySize('xl',null,true)`);const immediate=await fonts();await frame();const after=await fonts();observations.push({globalBefore:before,globalImmediate:immediate,globalXL:after});
    before.forEach((n,i)=>assert(Math.abs(after[i]/n-1.3)<0.015));
    await js(`TMThemeFont.applySize('md',null,true);TMThemeFont.applyScopeSize('memorial','md')`);await frame();const reset=await fonts();
    const original=observations.find(r=>r.fontsBefore).fontsBefore;reset.forEach((n,i)=>assert(Math.abs(n-original[i])<0.05));
  });
  await verify('default sidebar uses dark readable ink rather than faint low-contrast labels', async () => {
    const colors=await js(`['.aside .piaoni','.aside .who-info span','.aside .chain-row p','.aside .imp-pending'].map(s=>getComputedStyle(document.querySelector('.zou-yuan '+s)).color)`);
    observations.push({defaultColors:colors});colors.forEach(c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number);assert(Math.max(...rgb)<125);});
    await frame();
    fs.writeFileSync(path.join(out,'default-1600.png'),(await win.webContents.capturePage()).toPNG());
  });
  await verify('existing settings render a functional bounded memorial text-color selector', async () => {
    // Exercise visible text, and wait for its exact style within the existing
    // UI deadline; two animation frames alone do not prove style settlement.
    await js(`document.querySelector('.zou-yuan .ben-text').scrollIntoView({block:'center'})`);
    const value=await js(`(()=>{const d=document.createElement('div');d.id='mr-settings';d.innerHTML=TMThemeFont.renderControls();document.body.appendChild(d);const s=d.querySelector('[data-memorial-ink]');if(!s)return null;s.value='indigo';s.dispatchEvent(new Event('change',{bubbles:true}));return{options:[...s.options].map(o=>o.value),value:s.value,color:getComputedStyle(document.querySelector('.zou-yuan .ben-text')).color,saved:localStorage.getItem('tm.memorialInk')}})()`);
    await frame();const firstPaint=await js(`(()=>{const e=document.querySelector('.zou-yuan .ben-text');return{color:getComputedStyle(e).color,rect:e.getBoundingClientRect().toJSON(),rootInk:getComputedStyle(document.documentElement).getPropertyValue('--tm-memorial-ink'),visible:document.visibilityState}})()`);
    await wait(`getComputedStyle(document.querySelector('.zou-yuan .ben-text')).color==='rgb(38, 62, 80)'`);
    const painted=await js(`getComputedStyle(document.querySelector('.zou-yuan .ben-text')).color`);observations.push({inkImmediate:value&&value.color,inkFirstPaint:firstPaint,inkPainted:painted});
    assert(value);assert.deepEqual(value.options,['ink','black','indigo']);assert.equal(value.saved,'indigo');assert.equal(painted,'rgb(38, 62, 80)');
    await js(`document.getElementById('mr-settings')?.remove()`);
  });
  await verify('reading settings restore after reopen; invalid color cannot inject CSS', async () => {
    const result=await js(`(()=>{TMThemeFont.applyMemorialInk('black',true);TMPhase8FormalBridge.drafts.closeDeskOverlay();TMThemeFont.restore();TMPhase8FormalBridge.drafts.openYueZouPreviewPanel();const savedColor=getComputedStyle(document.querySelector('.zou-yuan .ben-text')).color;TMThemeFont.applyMemorialInk('x;}body{display:none}',true);return{savedColor,fallback:localStorage.getItem('tm.memorialInk'),display:getComputedStyle(document.body).display}})()`);
    assert.equal(result.savedColor,'rgb(24, 24, 24)');assert.equal(result.fallback,'ink');assert.notEqual(result.display,'none');
  });
  await verify('largest reading size at 1280x720 keeps text readable and every action reachable', async () => {
    await js(`document.getElementById('mr-settings')?.remove();TMThemeFont.applyScopeSize('memorial','xl');TMThemeFont.applySize('xl',null,true)`);
    win.setSize(1280,720);await js(`(async()=>{await new Promise(r=>setTimeout(r,300));})()`);await frame();
    const bounds=await js(`(()=>{const p=document.querySelector('.zou-yuan'),r=p.getBoundingClientRect(),reader=p.querySelector('.zouben');return{viewport:{width:innerWidth,height:innerHeight},panel:r.toJSON(),readerHeight:document.querySelector('.ben-body').clientHeight,overflow:getComputedStyle(reader).overflowY,controls:[...p.querySelectorAll('.pact')].map(b=>{b.scrollIntoView({block:'nearest'});const s=b.getBoundingClientRect(),hit=document.elementFromPoint(s.x+s.width/2,s.y+s.height/2);return{text:b.textContent,rect:s.toJSON(),inside:s.left>=r.left-1&&s.right<=r.right+1&&s.bottom<=r.bottom+1,hit:hit===b||b.contains(hit)}})}})()`);
    observations.push({largeBounds:bounds});
    fs.writeFileSync(path.join(out,'largest-1280.png'),(await win.webContents.capturePage()).toPNG());
    assert(bounds.readerHeight>=120);assert(['auto','scroll'].includes(bounds.overflow));assert(bounds.controls.every(b=>b.inside&&b.hit));
  });
  await verify('stale overlay input and clicks cannot write drafts into a different world', async () => {
    const result=await js(`(()=>{document.getElementById('mr-settings')?.remove();const ov=document.querySelector('#tm-action-memorial-overlay'),t=ov.querySelector('[data-desk-memorial-reply]'),b=ov.querySelector('.zou-folder[data-id="reading-31"]');GM={sid:'other-world',turn:2,_campaignId:'other-c',_timelineId:'other-t',memorials:[]};const before=JSON.stringify(GM);t.value='旧局迟到输入';t.dispatchEvent(new Event('input',{bubbles:true}));b.click();return{unchanged:JSON.stringify(GM)===before,removed:!ov.isConnected}})()`);
    assert(result.unchanged&&result.removed);
  });
  await verify('new world can open fresh and empty memorial list normally',async()=>{
    assert.equal(await js(`(()=>{TMPhase8FormalBridge.drafts.openYueZouPreviewPanel();return !!document.querySelector('.ben-empty')})()`),true);
  });
  await verify('existing world lease rejects in-place timeline/load changes and P replacement',async()=>{
    for(const mutation of ["GM._timelineId+='-fork'","window._tmLoadGen=(window._tmLoadGen||0)+1","P=Object.assign({},P)"]){
      const result=await js(`(()=>{GM.memorials=[{id:'same-id',turn:2,status:'pending',title:'新局奏疏',content:'新局正文'}];TMPhase8FormalBridge.drafts.openYueZouPreviewPanel();const ov=document.querySelector('#tm-action-memorial-overlay'),t=ov.querySelector('[data-desk-memorial-reply]');${mutation};const before=JSON.stringify(GM);t.value='失效输入';t.dispatchEvent(new Event('input',{bubbles:true}));ov.querySelector('.zou-folder').click();return JSON.stringify(GM)===before&&!ov.isConnected})()`);
      assert.equal(result,true,mutation);
    }
  });
  fs.writeFileSync(path.join(out,'memorial-reading-results.json'),JSON.stringify({complete:true,failures,observations,scope:'shared renderer in real isolated Electron; not live player data or native OS mouse'},null,2));
  if(failures.length)throw Error(failures.map(e=>e.name+': '+e.error).join('\n'));
};
