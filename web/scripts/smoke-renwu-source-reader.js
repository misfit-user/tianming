'use strict';
// Pure display/reference regressions: no user profiles, saves, network or AI calls.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
const office=fs.readFileSync(path.join(root,'tm-office-system.js'),'utf8');
const ctx={console};vm.createContext(ctx);
vm.runInContext(office.slice(office.indexOf('function _offNormalizeTitleName'),office.indexOf('function _offIsConcurrentAppointment')),ctx);
const view=c=>Array.from(ctx._offGetCharOfficeTitles(c,{displayOnly:true}));
check('composite and registered offices do not repeat',()=>{const c={officialTitle:'刑部尚书·盐铁转运使',officialTitles:['刑部尚书','盐铁转运使'],concurrentTitles:['刑部尚书','盐铁转运使']},saved=JSON.stringify(c);assert.deepEqual(view(c),['刑部尚书·盐铁转运使']);assert.equal(JSON.stringify(c),saved);});
check('real concurrent office is retained',()=>assert.deepEqual(view({officialTitle:'刑部尚书',concurrentTitles:['盐铁转运使']}),['刑部尚书','盐铁转运使']));
check('honorary and actual office are not substring-merged',()=>assert.deepEqual(view({officialTitle:'检校礼部尚书',concurrentTitles:['礼部尚书']}),['检校礼部尚书','礼部尚书']));
check('status qualifier survives deduplication',()=>assert.deepEqual(view({officialTitle:'太子少傅·分司东都',concurrentTitles:['太子少傅']}),['太子少傅·分司东都']));
check('existing compound display preserved',()=>assert.equal(ctx._offFormatCharTitles({officialTitle:'内阁首辅·建极殿大学士',concurrentTitles:['礼部尚书']}),'内阁首辅·建极殿大学士　兼　礼部尚书'));
const zhi=fs.readFileSync(path.join(root,'tm-renwu-tuzhi.js'),'utf8');
ctx.esc=v=>String(v==null?'':v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
ctx.state={tab:'sources',sel:'测试'};ctx.renderMain=()=>{};ctx.findP=()=>null;
vm.runInContext(zhi.slice(zhi.indexOf('var _zhiReferenceCache='),zhi.indexOf('function _zhiOfficeTitles(c)')),ctx);
check('reader rejects traversal and remote reference paths',()=>{for(const p of ['../secret.json','https://example.com/a.json','assets/reference/../../private.json'])assert.equal(ctx._zhiReferenceKey({historicalSourceRef:p}),'');});
check('empty earlier source field cannot hide historicalSources',()=>{const text=ctx.tabSources({_ref:{sourceNotes:[],historicalSources:['原文甲']}});assert(text.includes('原文甲'));});
check('untrusted quote text is escaped',()=>{const text=ctx.tabSources({_ref:{historicalSources:['<img src=x onerror=alert(1)>']}});assert(text.includes('&lt;img'));assert(!text.includes('<img'));});
const ref='assets/reference/test.json';
ctx._zhiReferenceCache[ref]={loading:false,data:{schemaVersion:1,scenarioId:'s',characters:{x:{name:'测试',quotes:[{book:'史籍',text:'后事只在阅读器',url:'https://example.com/'}],note:'日次待考'}}}};
check('reader archive does not mutate world or character',()=>{ctx.GM={turn:0};ctx.P={};const c={id:'x',sid:'s',historicalSourceRef:ref,historicalSources:[]},before=JSON.stringify([ctx.GM,ctx.P,c]);assert(ctx.tabSources({_ref:c}).includes('后事只在阅读器'));assert.equal(JSON.stringify([ctx.GM,ctx.P,c]),before);});
check('cross-scenario archive cannot bleed into another person',()=>{const html=ctx.tabSources({_ref:{id:'x',sid:'different',historicalSourceRef:ref,historicalSources:['本人的原文']}});assert(!html.includes('后事只在阅读器'));assert(html.includes('本人的原文'));});
check('honorary badge is marked and deduplicated',()=>{const h=ctx._zhiHonoraryPills({_ref:{honoraryTitles:['检校礼部尚书','检校礼部尚书']}});assert.equal((h.match(/data-zhi-honorary/g)||[]).length,1);assert(h.includes('衔 检校礼部尚书'));});
(async()=>{
 ctx.fetch=()=>Promise.reject(new Error('fixture missing file'));
 const c={id:'fail',sid:'s',historicalSourceRef:'assets/reference/missing.json',historicalSources:['随人物保留的原文']};
 ctx._zhiLoadReference({_ref:c});await new Promise(r=>setImmediate(r));
 check('missing file shows an error and preserves inline evidence',()=>{const html=ctx.tabSources({_ref:c});assert(html.includes('读取失败'));assert(html.includes('随人物保留的原文'));});
 console.log('[smoke-renwu-source-reader] PASS assertions='+count);
})().catch(e=>{console.error(e);process.exitCode=1;});
