'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'runtime-ui');fs.mkdirSync(out,{recursive:true});
process.env.TM_BRIDGE_TEST_ROOT=root;
process.env.TM_BRIDGE_TEST_MODE='character-actions';
process.env.TM_BRIDGE_TEST_REPORT=path.join(out,'office-dedupe-report.json');
process.env.TM_BRIDGE_TEST_USERDATA=fs.mkdtempSync(path.join(out,'userdata-'));
const target=require.resolve('../../scripts/electron/character-actions-cases.cjs');
require.cache[target]={id:target,filename:target,loaded:true,exports:async function({win,check}){
 const js=s=>win.webContents.executeJavaScript(s,true);
 const scenario=JSON.parse(fs.readFileSync(path.join(root,'scenarios/晚唐·开成五年（官方）.json'),'utf8'));
 const person=structuredClone(scenario.characters.find(c=>c.name==='崔珙'));
 assert(person&&person.id==='char-535ea9c19b97');
 person.officialTitle='刑部尚书·盐铁转运使';person.title=person.officialTitle;
 person.officialTitles=[person.officialTitle,'刑部尚书','盐铁转运使'];person.concurrentTitles=['刑部尚书','盐铁转运使'];
 await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,650));TM_Changelog.markRead();TM_Changelog.close();P.playerInfo={characterName:'李瀍'};P.characters=[];GM={sid:'sc-tang840-840',turn:1,playerInfo:{characterName:'李瀍'},chars:[${JSON.stringify(person)}],facs:[],vars:{},rels:{},officeTree:[],characterArcs:{},culturalWorks:[]};if(typeof buildIndices==='function')buildIndices();document.body.classList.add('tm-phase8-formal');openCharRenwuPage('崔珙');await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
 win.show();
 await check('real-production-character-header-deduplicates-old-save-composite-office',async()=>{
  const result=await js(`[...document.querySelectorAll('#tm-zhi-main .dh-pill')].map(e=>e.textContent.trim()).filter(t=>t.includes('刑部尚书')||t.includes('盐铁转运使'))`);
  assert.deepEqual(result,['刑部尚书·盐铁转运使']);
 });
 await check('production-character-identity-tab-keeps-office-without-repeated-concurrent-title',async()=>{
  await js(`TMZhi.switchTab('identity');`);
  const text=await js(`document.getElementById('tm-zhi-main').textContent`);
  assert(text.includes('刑部尚书·盐铁转运使'));
  assert(!text.includes('兼　刑部尚书、盐铁转运使'));
 });
 await check('display-query-does-not-mutate-world-or-change-mechanism-title-count',async()=>{
  const r=await js(`(()=>{const c=GM.chars[0],before=JSON.stringify(c),titles=_offGetCharOfficeTitles(c,{displayOnly:true}),after=JSON.stringify(c);return{before,after,titles,mechanismCount:_offGetCharOfficeTitles(c).length};})()`);
  assert.equal(r.before,r.after);assert.deepEqual(r.titles,['刑部尚书·盐铁转运使']);assert.equal(r.mechanismCount,3);
 });
 await js(`TMZhi.switchTab('overview');`);
 await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 fs.writeFileSync(path.join(out,'office-dedupe.png'),(await win.webContents.capturePage()).toPNG());
}};
require('../../scripts/electron/bridge-main.cjs');
