'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
module.exports=async function({win,check}){
 const root=path.resolve(__dirname,'../..'),s=JSON.parse(fs.readFileSync(path.join(root,'scenarios/晚唐·开成五年（官方）.json'),'utf8'));
 const js=x=>win.webContents.executeJavaScript(x,true);
 await check('tang-production-load-scenario-sees-updated-canonical-data',async()=>{const v=await js(`(async()=>{const x=await tianming.loadScenario('晚唐·开成五年（官方）');if(!x.success)return x;const c=x.data.characters.find(c=>c.name==='郑肃');return {success:true,source:x.source,count:x.data.characters.length,office:c.officialTitle,reference:c.historicalSourceRef};})()`);assert.equal(v.success,true);assert.equal(v.source,'official');assert.equal(v.count,434);assert.equal(v.office,'河中节度使');assert.equal(v.reference,'assets/reference/tang840-characters.json');});
 const data={sid:s.id,turn:0,_campaignId:'tang-reference-test',_timelineId:'isolated',_capital:'京兆府·长安',playerInfo:s.playerInfo,chars:s.characters,facs:s.factions,officeTree:s.officeTree,rels:{},vars:{},characterArcs:{},culturalWorks:[],evtLog:[],letters:[],edicts:[]};
 await js(`(async()=>{if(window.TM_Changelog){await TM_Changelog.getUnreadCount();TM_Changelog.markRead();TM_Changelog.close();}P.playerInfo=${JSON.stringify(s.playerInfo)};P.characters=[];GM=${JSON.stringify(data)};if(typeof buildIndices==='function')buildIndices();document.body.classList.add('tm-phase8-formal');openCharRenwuPage('崔珙');await document.fonts.ready;})()`);
 win.show();
 const wait=()=>js(`new Promise(r=>setTimeout(r,180))`);
 const open=async n=>{await js(`openCharRenwuPage(${JSON.stringify(n)});`);await wait();};
 const shot=async n=>{await js(`(async()=>{const p=document.getElementById('tm-zhi-overlay');if(p)await Promise.all(p.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished));await new Promise(r=>setTimeout(r,450));})()`);fs.writeFileSync(path.join(__dirname,n),(await win.webContents.capturePage()).toPNG());};
 const pills=()=>js(`Array.from(document.querySelectorAll('#tm-zhi-main .dh-pills .dh-pill')).map(x=>x.textContent.trim())`);
 await check('tang-actual-character-page-office-labels-unique',async()=>{
  const a=await pills();assert.equal(a.filter(x=>x.includes('刑部尚书')).length,1);assert.equal(a.filter(x=>x.includes('盐铁转运使')).length,1);await shot('cui-gong-offices.png');
 });
 await check('tang-old-save-composite-office-labels-unique-read-only',async()=>{
  await js(`(()=>{const c=GM.chars.find(c=>c.name==='崔珙');c.officialTitle='刑部尚书·盐铁转运使';c.officialTitles=['刑部尚书·盐铁转运使','刑部尚书','盐铁转运使'];c.concurrentTitles=['刑部尚书','盐铁转运使'];c.concurrentTitle='刑部尚书、盐铁转运使';})()`);
  await open('崔珙');const a=await pills();assert.equal(a.filter(x=>x.includes('刑部尚书')).length,1);assert.equal(a.filter(x=>x.includes('盐铁转运使')).length,1);
 });
 await check('tang-zheng-su-honorary-separate-from-real-offices',async()=>{
  await open('郑肃');const a=await pills();assert(a.includes('河中节度使'));assert(a.includes('衔 检校礼部尚书'));
  const o=await js(`_offGetCharOfficeTitles(GM.chars.find(c=>c.name==='郑肃'))`);assert(!o.includes('礼部尚书'));assert(!o.includes('检校礼部尚书'));const overlap=await js(`(()=>{const ring=document.querySelector('#tm-zhi-main .dh-loy').getBoundingClientRect();return [...document.querySelectorAll('#tm-zhi-main .dh-pill')].some(e=>{const p=e.getBoundingClientRect();return p.left<ring.right&&p.right>ring.left&&p.top<ring.bottom&&p.bottom>ring.top;});})()`);assert(!overlap,'Office badges overlap the loyalty ring');await shot('zheng-su-offices.png');
 });
 const sourceTab=async()=>{
  const hit=await js(`(async()=>{for(let i=0;i<25;i++){const b=Array.from(document.querySelectorAll('#tm-zhi-main .tab')).find(x=>x.textContent==='史料与校勘');if(!b)return false;b.scrollIntoView({block:'nearest',inline:'nearest'});await new Promise(r=>setTimeout(r,80));const v=b.getBoundingClientRect(),top=document.elementFromPoint(v.x+v.width/2,v.y+v.height/2);if((top===b||b.contains(top))&&v.width>0&&v.height>0){b.click();return true;}}return false;})()`);assert.equal(hit,true,'source tab must be reachable');
  await js(`(async()=>{for(let i=0;i<35;i++){if(!document.querySelector('[data-zhi-sources]')?.textContent.includes('正在读取'))return;await new Promise(r=>setTimeout(r,100));}})()`);
 };
 await check('tang-source-reader-real-file-loading-and-world-isolation',async()=>{
  await open('李瀍');const before=await js('JSON.stringify(GM)');await sourceTab();
  const result=await js(`({text:document.querySelector('[data-zhi-sources]')?.textContent,count:document.querySelectorAll('[data-zhi-original]').length})`);
  assert.equal(result.count,2,result.text);assert(result.text.includes('文宗暴疾'));assert(result.text.includes('十四日'));assert.equal(await js('JSON.stringify(GM)'),before);await shot('emperor-original-sources.png');
 });
 await check('tang-cui-gong-later-evidence-reader-only',async()=>{
  await open('崔珙');const before=await js('JSON.stringify(GM)');await sourceTab();assert.equal(await js(`document.querySelector('[data-zhi-sources]').textContent.includes('夏，五月')`),true);assert.equal(await js(`GM.chars.find(c=>c.name==='崔珙').historicalSources.some(x=>x.includes('夏，五月'))`),false);assert.equal(await js('JSON.stringify(GM)'),before);
 });
 await check('tang-unverified-original-is-not-fabricated',async()=>{
  await open('洪辩');await sourceTab();assert.equal(await js(`document.querySelectorAll('[data-zhi-original]').length`),0);assert.equal(await js(`document.querySelector('[data-zhi-sources]').textContent.includes('原文待核')`),true);await shot('pending-original-evidence.png');
 });
 await check('tang-fictional-character-has-no-fake-original',async()=>{
  await open(s.characters[63].name);await sourceTab();assert.equal(await js(`document.querySelectorAll('[data-zhi-original]').length`),0);assert.equal(await js(`document.querySelector('[data-zhi-sources]').textContent.includes('虚构角色')`),true);
 });
};
