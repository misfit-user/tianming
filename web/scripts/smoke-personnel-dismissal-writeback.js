'use strict';
// Exercise the shipped applier, office identity writer, reload bind and portrait reader.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const web=path.resolve(__dirname,'..');let passed=0;
const equal=(a,b,m)=>{assert.deepEqual(a,b,m);passed++;};
function fixture(options={}){
 const c={console:{log(){},warn(){},error(){}},Date,Math,JSON,Object,Array,Set,Map,WeakMap,Promise,Number,String,Boolean,RegExp,isFinite,isNaN,parseInt,parseFloat,setTimeout(){},clearTimeout(){},getTSText:()=>'',addEB(){},escHtml:String};
 c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-office-system.js','tm-start-contracts.js','tm-start-world.js','tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js'])vm.runInContext(fs.readFileSync(path.join(web,f),'utf8'),c,{filename:f});
 const zhi=fs.readFileSync(path.join(web,'tm-renwu-tuzhi.js'),'utf8');vm.runInContext(zhi.slice(zhi.indexOf('function _zhiOfficeTitles'),zhi.indexOf('function adaptChar')),c);
 c.GM={turn:2,chars:[{id:'cui',name:'崔呈秀',alive:true,officialTitle:'兵部尚书',title:'兵部尚书',position:'兵部尚书',currentPosition:{title:'兵部尚书'},faction:'明朝廷'}],facs:[],armies:[],guoku:{money:1000},neitang:{money:0},_turnReport:[],officeTree:[{name:'兵部',positions:[{id:'war-minister',name:'兵部尚书',holder:'崔呈秀',holderId:'cui',establishedCount:1,headCount:1,actualCount:1,vacancyCount:0,actualHolders:[{characterId:'cui',name:'崔呈秀',generated:true}]}]}]};
 c.P={playerInfo:{factionName:'明朝廷'}};
 if(options.idOnly)delete c.GM.officeTree[0].positions[0].actualHolders[0].name;
 if(options.children)c.GM.officeTree=[{name:'六部',children:c.GM.officeTree}];
 if(options.native){c.GM.startContext={schemaVersion:'tm-start-context/1',playerFactionId:'ming'};c.GM.nativeWorld={offices:{ming:c.GM.officeTree},baseOfficeTree:[]};}
 c.GM.edicts=[{turn:2,status:'promulgated',text:'崔呈秀革职抄家，拘押候勘。'}];
 c.confiscations=0;c.EconomyLinkage={triggerConfiscationByName(){c.confiscations++;return {success:true,total:0,visible:0,hidden:0};}};
 return c;
}
function apply(c,change,extra={}){return c.applyAITurnChanges({personnel_changes:[{name:'崔呈秀',former:'兵部尚书',change,reason:'奉旨查办',...extra}]});}
function seats(c){const a=[];(function walk(ns){for(const n of ns||[]){a.push(...n.positions||[]);walk(n.subs);walk(n.children);}})(c.GM.officeTree);return a;}
function removed(c){const ch=c.GM.chars.find(x=>x.id==='cui');equal(ch.officialTitle,null,'main title cleared');equal(ch.title,'','legacy title cleared');equal(ch.currentPosition.title,'','current-position mirror cleared');equal(c._zhiOfficeLine({...ch,officeTitles:c._zhiOfficeTitles(ch)}),'布衣','actual portrait reader no longer shows the office');for(const p of seats(c)){equal((p.actualHolders||[]).some(h=>h.characterId==='cui'),false,'stable seat removed');equal(p.holderId==='cui',false,'stable primary mirror removed');}return ch;}
for(const options of [{},{idOnly:true},{children:true},{native:true,idOnly:true}]){
 const c=fixture(options);equal(apply(c,'革职抄家·拘押候勘').ok,true,'screenshot verdict applies');equal(removed(c)._imprisoned,true,'custody recorded');equal(c.confiscations,1,'confiscation called once');
 equal(apply(c,'革职抄家·拘押候勘').ok,true,'replayed personnel result is safe');equal(c.confiscations,1,'replay never confiscates twice');
 c.GM=JSON.parse(JSON.stringify(c.GM));c._offSyncHoldersFromChars({importSeats:true,force:true});removed(c);
 equal(seats(c)[0].actualCount,0,'reload keeps vacancy count');equal(seats(c)[0].vacancyCount,1,'one vacant seat remains');
}
for(const change of ['革职','撤职','褫职','革除官职','削职']){const c=fixture();equal(apply(c,change).ok,true,'dismissal verb recognized: '+change);removed(c);equal(c.confiscations,0,'dismissal does not invent confiscation');}
{
 const c=fixture();c.GM.edicts=[];c.GM._edictTracker=[{id:'edict',turn:2,status:'pending',content:'令崔呈秀革职抄家，拘押候勘。'}];equal(apply(c,'革职抄家·拘押候勘').ok,true,'category-input tracker is an actual player source');removed(c);
}
for(const kind of ['missing','old','draft','cancelled','in-transit']){
 const c=fixture();c.GM.edicts=[];
 if(kind==='old')c.GM.edicts=[{turn:1,status:'promulgated',text:'崔呈秀革职抄家。'}];
 if(kind==='draft')c.GM.edicts=[{turn:2,status:'draft',text:'崔呈秀革职抄家。'}];
 if(kind==='cancelled')c.GM._edictTracker=[{id:'e',turn:2,status:'cancelled',content:'崔呈秀革职抄家。'}];
 if(kind==='in-transit'){c.GM._edictTracker=[{id:'e',turn:2,status:'pending',content:'崔呈秀革职抄家。',_letterIds:['l']}];c.GM.letters=[{id:'l',status:'travelling'}];}
 equal(apply(c,'革职抄家·拘押候勘').ok,false,'judicial source gate still rejects '+kind);equal(c.GM.chars[0].officialTitle,'兵部尚书','rejected batch preserves person');equal(seats(c)[0].holder,'崔呈秀','rejected batch preserves seat');
}
{
 const c=fixture(),peer={id:'peer',name:'崔呈秀',alive:true,officialTitle:'礼部尚书',title:'礼部尚书'};c.GM.chars.push(peer);c.GM.officeTree.push({name:'礼部',positions:[{name:'礼部尚书',establishedCount:1,actualHolders:[{characterId:'peer',name:'崔呈秀',generated:true}],holderId:'peer',holder:'崔呈秀'}]});
 equal(apply(c,'革职').ok,false,'ambiguous bare name is not guessed');equal(apply(c,'革职',{characterId:'cui'}).ok,true,'stable ID resolves namesake');equal(c.GM.chars.find(x=>x.id==='peer').officialTitle,'礼部尚书','namesake is preserved');equal(seats(c)[1].actualHolders[0].characterId,'peer','namesake seat is preserved');
}
for(const change of ['留任察看','暂不革职','未予革职','拟革职','建议革职']){
 const c=fixture();equal(apply(c,change).ok,true,'non-executed row accepted: '+change);equal(c.GM.chars[0].officialTitle,'兵部尚书','former does not turn arbitrary text into an appointment');equal(seats(c)[0].holder,'崔呈秀','non-executed text does not vacate a seat');
}
{
 const c=fixture();c.GM.officeTree.push({name:'星务院',positions:[{name:'首席观星官',holder:'',headCount:1,establishedCount:1,actualHolders:[]}]});
 equal(apply(c,'首席观星官').ok,true,'a bare scenario-defined appointment still applies');equal(c.GM.chars[0].officialTitle,'首席观星官','scenario-defined title does not require an engine keyword');equal(seats(c)[1].holder,'崔呈秀','scenario-defined seat is occupied');
}
console.log('[smoke-personnel-dismissal-writeback] PASS '+passed+' assertions');
