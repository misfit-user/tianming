'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'runtime-full');fs.mkdirSync(out,{recursive:true});
process.env.TM_BRIDGE_TEST_ROOT=root;
process.env.TM_BRIDGE_TEST_MODE='native-start-neutral-atlas';
process.env.TM_BRIDGE_TEST_REPORT=path.join(out,'report.json');
process.env.TM_BRIDGE_TEST_USERDATA=fs.mkdtempSync(path.join(out,'userdata-'));
const target=require.resolve('../../scripts/electron/native-neutral-atlas-cases.cjs');
require.cache[target]={id:target,filename:target,loaded:true,exports:async function({win,check}){
 const js=s=>win.webContents.executeJavaScript(s,true);
 const source=(()=>{const s=JSON.parse(fs.readFileSync(path.join(root,'scenarios/晚唐·开成五年（官方）.json'),'utf8'));return{id:s.id,characters:s.characters.map(c=>({id:c.id,name:c.name,isHistorical:c.isHistorical,historicalSourceRef:c.historicalSourceRef,concurrentTitles:c.concurrentTitles||[]}))};})();
 assert.equal(source.characters.length,434);assert(source.characters[0].historicalSourceRef,'Data update must be installed before testing');
 const settle=()=>js(`(async()=>{const ov=document.getElementById('tm-zhi-overlay');if(ov)await Promise.all(ov.getAnimations({subtree:true}).filter(a=>a.effect&&a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await document.fonts.ready;await new Promise(r=>setTimeout(r,150));})()`);
 const open=async name=>{await js(`openCharRenwuPage(${JSON.stringify(name)});`);await settle();};
 await check('real-official-tang-scenario-starts-from-synced-bundle',async()=>{
  await js(`(async()=>{await new Promise(r=>setTimeout(r,650));const close=document.querySelector('#tm-changelog-ov .tm-cl-close');if(close)close.click();await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure('sc-tang840-840');P.ai={key:'',url:'',model:''};await startGame('sc-tang840-840');})()`);
  const coords=await js(`(async()=>{const end=Date.now()+10000;while(Date.now()<end){const e=document.getElementById('tm-op-enter');if(e){const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(e.contains(document.elementFromPoint(x,y)))return{x:Math.round(x),y:Math.round(y)};}await new Promise(r=>setTimeout(r,50));}throw Error('Opening ceremony enter button not clickable');})()`);
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...coords});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...coords});
  await js(`(async()=>{const end=Date.now()+65000;while(!GM.running||GM.sid!=='sc-tang840-840'){if(Date.now()>end)throw Error('Tang startup timed out');await new Promise(r=>setTimeout(r,50));}})()`);
  const r=await js(`({sid:GM.sid,characters:GM.chars.length,missing:P.scenarios.find(s=>s.id===GM.sid).characters.filter(c=>!GM.chars.some(x=>x.id===c.id)).map(c=>c.id)})`);
  assert.equal(r.sid,source.id);assert.equal(r.characters,434);assert.deepEqual(r.missing,[]);
 });
 win.show();
// Test fixture only: dismiss first-run help in the isolated Electron test profile.
// These are the help dialog's ordinary close controls, not game actions or account settings.
await js(`(() => {
  const guideButton = document.querySelector('#tm-firstturn-guide button.bt.bp');
  if (guideButton) guideButton.click();
  const hintButton = document.querySelector('#tm-nokey-banner button.bt.bs');
  if (hintButton) hintButton.click();
})()`);
 await check('corrected-offices-survive-real-start-and-do-not-steal-central-seats',async()=>{
  const r=await js(`(()=>{const wanted=['郑肃','崔龟从','杜悰','李固言','崔珙'];const people=GM.chars.filter(c=>wanted.includes(c.name)).map(c=>({name:c.name,title:c.officialTitle,location:c.location,honor:c.honoraryTitles||[]}));const seats=[];function walk(v){if(!v||typeof v!=='object')return;if(v.name&&Object.prototype.hasOwnProperty.call(v,'holder'))seats.push({name:v.name,holder:v.holder,holderId:v.holderId});Object.values(v).forEach(x=>{if(x&&typeof x==='object')walk(x);});}walk(GM.officeTree);return{people,seats};})()`);
  r.diagnostic=await js(`(()=>{const c=GM.chars.find(c=>c.name==='崔龟从');return{character:c,claims:_offGetCharOfficeTitles(c),score:_offTitleSlotScore('权判吏部尚书铨事','吏部','吏部尚书',false),scorer:_offTitleSlotScore.toString().slice(0,1100),scripts:[...document.scripts].filter(s=>s.src.includes('office')).map(s=>s.src)};})()`);
  fs.writeFileSync(path.join(out,'office-diagnostic.json'),JSON.stringify(r,null,2));
  const people=Object.fromEntries(r.people.map(c=>[c.name,c]));
  assert.equal(people['郑肃'].title,'河中节度使');assert.equal(people['郑肃'].location,'河中府');
  const retained=await js(`GM.chars.filter(c=>['郑肃','李固言','崔龟从'].includes(c.name)).map(c=>({name:c.name,extra:c.concurrentTitles}))`);for(const row of retained){const expected=source.characters.find(c=>c.name===row.name).concurrentTitles;for(const title of expected)assert(row.extra.includes(title),row.name+' lost genuine additional post '+title);}
  assert.equal(people['崔龟从'].title,'户部侍郎');assert.equal(people['杜悰'].title,'户部尚书');
  assert(people['李固言'].honor.includes('检校尚书左仆射'));
  for(const [seat,name] of [['河中节度使','郑肃'],['户部尚书','杜悰'],['户部侍郎','崔龟从']])assert(r.seats.some(p=>p.name===seat&&p.holder===name),seat+' holder not updated');
  assert(!r.seats.some(p=>p.name==='礼部尚书'&&p.holder==='郑肃'),'Honorary appointment gained real ministry');
  assert(!r.seats.some(p=>p.name==='吏部尚书'&&p.holder==='崔龟从'),'Temporary selection duty gained real minister seat');
 });
 await check('all-historical-source-identities-are-present-after-real-start',async()=>{
  const rows=await js(`GM.chars.filter(c=>c.isHistorical).map(c=>({id:c.id,ref:c.historicalSourceRef,key:c.historicalSourceKey,count:Array.isArray(c.historicalSources)?c.historicalSources.length:-1}))`);
  assert.equal(rows.length,81);assert(rows.every(c=>c.ref==='assets/reference/tang840-characters.json'&&c.key===c.id&&c.count>0));
 });
 const selectSources=async name=>{await open(name);await js(`TMZhi.switchTab('sources');`);await settle();};
 await check('emperor-primary-text-loads-from-independent-local-reference-asset',async()=>{
  await selectSources('李瀍');
  await js(`(async()=>{const end=Date.now()+15000;while(!document.querySelector('[data-zhi-original]')){const text=document.getElementById('tm-zhi-main').textContent;if(text.includes('读取失败'))throw Error(text.slice(-1200));if(Date.now()>end)throw Error('Source archive did not load');await new Promise(r=>setTimeout(r,60));}})()`);
  const t=await js(`document.querySelector('[data-zhi-sources]').textContent`);
  assert(t.includes('五年正月二日，文宗暴疾'));assert(t.includes('四日，文宗崩'));assert(t.includes('十四日，受冊'));
  await settle();await js(`document.querySelector('[data-zhi-sources]').scrollIntoView({block:'start'});`);await settle();
  fs.writeFileSync(path.join(out,'emperor-sources.png'),(await win.webContents.capturePage()).toPNG());
 });
 await check('all-81-historical-pages-show-79-quoted-and-2-explicitly-pending-records',async()=>{
  const rows=await js(`(async()=>{const people=GM.chars.filter(c=>c.isHistorical),out=[];for(const c of people){TMZhi.selectP(c.name);TMZhi.switchTab('sources');const p=document.querySelector('[data-zhi-sources]');out.push({id:c.id,quoted:p.querySelectorAll('[data-zhi-original]').length,pending:p.textContent.includes('原文待核：'),name:p.textContent.includes(c.name)});await new Promise(r=>setTimeout(r,20));}return out;})()`);
  assert.equal(rows.filter(c=>c.quoted>0).length,79);assert.equal(rows.filter(c=>c.pending).length,2);
  fs.writeFileSync(path.join(out,'source-coverage.json'),JSON.stringify(rows,null,2));
 });
 await check('retrospective-quotations-do-not-enter-character-memory-or-ai-context',async()=>{
  await selectSources('崔珙');
  const r=await js(`(()=>{const c=GM.chars.find(x=>x.name==='崔珙'),text=document.querySelector('[data-zhi-sources]').textContent,needle='夏，五月，己卯';return{display:text.includes(needle),person:JSON.stringify(c).includes(needle),memory:JSON.stringify(c._memory||[]).includes(needle),ai:window.CharFullSchema&&CharFullSchema.toAIContext(JSON.parse(JSON.stringify(c)))};})()`);
  assert(r.display);assert(!r.person);assert(!r.memory);assert.equal(typeof r.ai,'string');assert(!r.ai.includes('夏，五月，己卯'));
 });
 await check('fictional-characters-have-no-fabricated-ancient-source',async()=>{
  const name=source.characters.find(c=>!c.isHistorical).name;await selectSources(name);
  const r=await js(`({text:document.querySelector('[data-zhi-sources]').textContent,quotes:document.querySelectorAll('[data-zhi-original]').length})`);
  assert(r.text.includes('虚构角色'));assert.equal(r.quotes,0);
 });
 await check('corrected-zheng-su-header-separates-honorary-title-and-is-visible',async()=>{
  await open('郑肃');await js(`TMZhi.switchTab('identity');document.getElementById('tm-zhi-main').scrollTop=0;`);await settle();
  const r=await js(`(()=>{const e=document.querySelector('#tm-zhi-main .dh-pill[data-zhi-honorary]');const h=document.querySelector('#tm-zhi-main .dossier-head')||document.querySelector('#tm-zhi-main .dh-pill');const b=h.getBoundingClientRect(),t=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{honor:e&&e.textContent,visible:!!t&&(t===h||h.contains(t)),text:document.getElementById('tm-zhi-main').textContent};})()`);
  const overlap=await js(`(()=>{const ring=document.querySelector('#tm-zhi-main .dh-loy').getBoundingClientRect();return [...document.querySelectorAll('#tm-zhi-main .dh-pill')].some(e=>{const p=e.getBoundingClientRect();return p.left<ring.right&&p.right>ring.left&&p.top<ring.bottom&&p.bottom>ring.top;});})()`);assert(!overlap,'Office tags overlap the loyalty ring');
  assert(r.honor.includes('检校礼部尚书'));assert(r.text.includes('河中节度使'));assert(r.text.includes('河中府'));assert(r.visible,'Corrected character header is obscured');
  fs.writeFileSync(path.join(out,'zheng-su-corrected.png'),(await win.webContents.capturePage()).toPNG());
 });
 await check('canonical-save-roundtrip-retains-new-character-data-and-excludes-observer-archive',async()=>{
  const r=await js(`(()=>{const s=_buildSaveState({format:'idb',detach:true}),c=s.GM.chars.find(x=>x.name==='郑肃');const payload=JSON.stringify(s);return{ref:c.historicalSourceRef,office:c.officialTitle,location:c.location,father:c.father,hasFuture:payload.includes('夏，五月，己卯'),count:s.GM.chars.length};})()`);
  assert.equal(r.count,434);assert.equal(r.office,'河中节度使');assert.equal(r.location,'河中府');assert.equal(r.father,'郑阅');assert.equal(r.ref,'assets/reference/tang840-characters.json');assert(!r.hasFuture);
 });
}};
require('../../scripts/electron/bridge-main.cjs');
