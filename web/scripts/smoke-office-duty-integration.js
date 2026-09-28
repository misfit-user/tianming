'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const web=path.resolve(__dirname,'..');let checks=0;
function ok(v,m){assert(v,m);checks++;}function near(a,b,m){ok(Math.abs(a-b)<1e-8,m+': '+a+' / '+b);}
function load(c,file){if(!c.SettlementPipeline)c.SettlementPipeline={register(){}};vm.runInContext(fs.readFileSync(path.join(web,file),'utf8'),c,{filename:file});}
function fixture(){const c={console,Math,JSON,GM:{turn:12,chars:[],officeTree:[]},P:{conf:{}},setTimeout(){},setInterval(){},clearTimeout(){},clearInterval(){},addEB(){},saveP(){},escHtml:s=>String(s==null?'':s),turnsForDuration:()=>12};c.window=c;c.globalThis=c;c.global=c;vm.createContext(c);['tm-office-holder-state.js','tm-office-action-evidence.js','tm-office-system.js','tm-office-dutystate.js','tm-office-authority.js','tm-office-powermap.js'].forEach(f=>load(c,f));c.findCharByName=n=>c.GM.chars.find(x=>x.name===n);const ch={id:'person',name:'甲',alive:true,officialTitle:'征税使',intelligence:80,administration:80,virtue:80,benevolence:80,loyalty:80,wuchang:{ren:80,yi:80,li:80,zhi:80,xin:80}};c.GM.chars=[ch];c.GM.officeTree=[{id:'office',name:'财赋署',positions:[{id:'tax',name:'征税使',holder:'甲',holderId:ch.id,establishedCount:1,actualCount:1,vacancyCount:0,powers:{taxCollect:true},actualHolders:[{characterId:ch.id,name:ch.name,generated:true,appointedTurn:1,appointmentId:'tenure-1'}],_dutyState:{fulfillment:50}}]}];return c;}
function p(c){return c.GM.officeTree[0].positions[0];}function ch(c){return c.GM.chars[0];}
{
 const c=fixture();Object.assign(p(c),{occupancyStatus:'unrecorded',holder:'',actualHolders:undefined});c._offMigratePosition(p(c));ok(p(c).holderId==='person'&&p(c).holder==='甲','migration preserves ID-only holder despite unrecorded flag');
 const idOnly={holderId:'person',holder:'',actualHolders:[],powers:{taxCollect:true}};c._offMigratePosition(idOnly);ok(idOnly.holderId==='person'&&idOnly.holder==='甲'&&idOnly.actualCount===1,'ID-only empty mirror survives absent counts');
 p(c).actualHolders=[{characterId:'person',name:'',generated:false}];c._offMigratePosition(p(c));ok(p(c).holderId==='person'&&p(c).actualHolders[0].generated===true,'valid canonical ID repairs missing name and materialization flag');
 const invalid={characterId:'甲',name:'甲',generated:true};const r=c._offMigrateHolderIdentity(invalid);ok(!r.ok&&invalid.characterId==='甲','invalid ID equal to another person name never falls back');
 Object.assign(p(c),{holder:'',holderId:'',actualCount:2,establishedCount:2,vacancyCount:0,actualHolders:[],occupancyStatus:undefined});c._offMigratePosition(p(c));near(c._offPositionStats(p(c)).actualCount,2,'canonical empty rows preserve declared anonymous occupancy');near(c.TM.OfficeHolderState.read(c.GM,p(c)).actualCount,2,'common reader agrees with normalized statistics');
 load(c,'tm-office-runtime.js');load(c,'tm-office-runtime-summary-appoint.js');ok(c._officePosMatchFilter(p(c),'filled')&&!c._officePosMatchFilter(p(c),'empty'),'list filter recognizes anonymous staff');
 const html=c._ogRenderPosCardV10({node:p(c),parent:{node:c.GM.officeTree[0]},path:[0,'p',0],x:0,y:0,w:300,h:200},'civil');ok(html.includes('姓名未详')&&!html.includes('此 职 无 人'),'position card distinguishes unrecorded from vacant');
 load(c,'tm-npc-action-ledger.js');c.GM.chars.push({id:'same-name-player',name:'甲',isPlayer:true});const pf=c.TM.NPC.ActionLedger.preflight;
 ok(pf({actor:'错误姓名镜像',characterId:'person',action:'查办账目'},c.GM).ok,'upstream preflight uses valid actor ID over the name mirror');
 ok(!pf({actor:'甲',characterId:'wrong-id',action:'查办账目'},c.GM).ok,'upstream invalid actor ID cannot fall back to same name');
 ok(!pf({actor:'甲',action:'查办账目'},c.GM).ok,'upstream ambiguous actor name is rejected');
}
{
 const c=fixture();load(c,'tm-endturn-helpers.js');const score=()=>{const r=c.runAnnualReview();return [...r.excellent,...r.adequate,...r.poor][0].score;};
 const b=score();ch(c).loyalty=80;ch(c)._memory=Array.from({length:30},()=>({importance:10,event:'丧亲之痛'}));near(score(),b,'important memories do not add tenure merits');ch(c).loyalty=80;
 ch(c)._achievementEvidence=[{kind:'achievement',eventId:'case',positionId:'tax',characterId:'person',outcome:'success',turn:10},{kind:'achievement',eventId:'case',positionId:'tax',characterId:'person',outcome:'success',turn:10}];near(c.TM.OfficeActionEvidence.tenureAchievements(c.GM,ch(c)),3,'one verified event counted once');
 p(c).actualHolders[0].appointedTurn=11;near(c.TM.OfficeActionEvidence.tenureAchievements(c.GM,ch(c)),0,'older-tenure results are excluded');
 Object.assign(ch(c),{intelligence:0,administration:0,virtue:0,benevolence:99,loyalty:0,wuchang:{ren:0,yi:0,li:0,zhi:0,xin:0},_achievementEvidence:[]});near(score(),0,'zero ability, virtue, loyalty and five constants stay zero');
}
{
 const c=fixture();load(c,'tm-char-economy-engine.js');const before=JSON.stringify(ch(c));c.CharEconEngine.addAchievement(ch(c),0,'零功绩',{eventId:'zero'});ok(JSON.stringify(ch(c))===before,'zero achievement does not create a default award');
 const event={eventId:'done',positionId:'tax',outcome:'success'};c.CharEconEngine.addAchievement(ch(c),5,'查清账案',event);c.GM.turn++;c.CharEconEngine.addAchievement(ch(c),5,'查清账案',event);near(ch(c)._recentAchievements,5,'merit event replay across turns is idempotent');near(c.TM.OfficeActionEvidence.tenureAchievements(c.GM,ch(c)),3,'achievement producer writes usable matter and tenure evidence');
 const saved=JSON.stringify(c.GM);c.GM=JSON.parse(saved);c.CharEconEngine.addAchievement(ch(c),5,'查清账案',event);near(ch(c)._recentAchievements,5,'merit receipts survive serialization');
 const tick=fs.readFileSync(path.join(web,'tm-char-economy-engine.js'),'utf8').split('  function tickVirtueMerit(ch, mr) {')[1].split('\n  function tickFame')[0];
 c.num=v=>Number(v)||0;c.updateVirtueStage=()=>{};vm.runInContext('function probeMerit(ch,mr){'+tick,c);
 function run(parts){const a={resources:{virtueMerit:0},_recentAchievements:12};parts.forEach(d=>c.probeMerit(a,d/30));return a;}
 const a=run([30]),b=run(Array(30).fill(1));near(a._recentAchievements,b._recentAchievements,'achievement decay follows elapsed days');near(a.resources.virtueMerit,b.resources.virtueMerit,'buffer reward integrates elapsed days');
 const frozen={resources:{virtueMerit:0},_recentAchievements:12,_imprisoned:true};c.probeMerit(frozen,1/30);near(frozen._recentAchievements,12*Math.pow(.6,1/30),'frozen official buffer also uses elapsed time');
}
{
 function run(parts){const c=fixture();ch(c).health=100;const virtues=JSON.stringify(ch(c).wuchang);c.applyNpcActionToDuty(c.GM,{characterId:'person',actionId:'leave',positionId:'tax',action:'告病',dutyEvidence:{actorId:'person',kind:'leave',status:'confirmed',approved:true,canPerform:false,startDay:0,endDay:15}});let comp=0;parts.forEach((d,i)=>{c.GM.turn=i+1;comp+=c.tickOfficeDutyState(c.GM,{days:d}).compliance;});ok(JSON.stringify(ch(c).wuchang)===virtues,'approved leave never deducts virtue');return {f:p(c)._dutyState.fulfillment,comp};}
 const a=run([30]),b=run([15,15]),d=run(Array(30).fill(1));near(a.f,b.f,'leave expiry splits long interval');near(a.f,d.f,'leave boundary matches daily turns');near(a.comp,d.comp,'leave effects split on same boundary');
 const c=fixture();c.GM.chars.push({id:'delegate',name:'乙',administration:90,wuchang:{ren:90,yi:90,li:90,zhi:90,xin:90}});p(c).officeLeave={approved:true,canPerform:false,delegateId:'delegate'};c.tickOfficeDutyState(c.GM);ok(p(c)._dutyState.fulfillment>50,'approved capable deputy continues work');
 p(c)._dutyState={fulfillment:50};p(c).officeLeave.approved=false;c.GM.turn++;c.tickOfficeDutyState(c.GM);ok(p(c)._dutyState.fulfillment<50,'unapproved deputy is not assumed authorized');
}
{
 const h=fs.readFileSync(path.join(__dirname,'smoke-ai-writeback-integrity.js'),'utf8').replace(/^#![^\n]*\n/,'').split('async function main()')[0];const helpers=new Function('require','__dirname',h+';return {makeContext,baseGM};')(require,__dirname);
 const c=helpers.makeContext();c.GM=helpers.baseGM({turn:1,daysPerTurn:1,guoku:{money:1000,balance:1000,extraIncome:[],extraExpense:[]},officeTree:[{name:'财赋署',positions:[{name:'征税使',holder:'',powers:{taxCollect:true},_dutyState:{fulfillment:50}}]}]});c.P={playerInfo:{factionName:'本朝'},time:{daysPerTurn:1}};
 ['tm-office-holder-state.js','tm-office-action-evidence.js','tm-office-dutystate.js','tm-office-authority.js'].forEach(f=>load(c,f));c._getDaysPerTurn=()=>c.P.time.daysPerTurn;c.officeFlagOn=k=>k==='officeAuthorityGateEnabled';let corruption=0;c.FiscalEngine={adjustPlayerDivisionCorruption(f,d){corruption+=d;return 1;}};
 const row={operationId:'tax-order',target:'guoku',kind:'income',resource:'money',amount:100,name:'征税',category:'田赋'};
 const first=c.applyAITurnChanges({fiscal_adjustments:[row]});ok(first.ok,'production fiscal writeback commits');const n=corruption;ok(n>0,'authority domain effect applied once');c.GM.turn++;const again=c.applyAITurnChanges({fiscal_adjustments:[JSON.parse(JSON.stringify(row))]});ok(again.ok,'stable operation replay commits as no-op');near(corruption,n,'production fiscal replay cannot duplicate corruption effect');
 c.officeFlagOn=k=>k==='officeDutyStateEnabled';ok(c.applyAITurnChanges({}).ok,'main production applier reaches duty settlement');near(p(c)._dutyState.fulfillment,49.6,'real reconcile uses one game day, not one month');const f=p(c)._dutyState.fulfillment;c._applyOfficeDutyTick(c.GM);near(p(c)._dutyState.fulfillment,f,'real reconcile retains same-turn guard');
 // Actual fiscal writer: distinct jurisdictions retain their own effects, even when totals cancel.
 load(c,'tm-fiscal-engine.js');c.GM.adminHierarchy={player:{divisions:[{id:'a',name:'甲地',fiscal:{compliance:.5},corruption:20},{id:'b',name:'乙地',fiscal:{compliance:.5},corruption:20}]}};
 c.GM.chars=[{id:'worker',name:'兼官',administration:90,wuchang:{ren:90,yi:90,li:90,zhi:90,xin:90}}];
 c.GM.officeTree=[{name:'地方',positions:['a','b'].map((id,i)=>({id,holderId:'worker',holder:'兼官',jurisdictionId:id,powers:i?{supervise:true}:{taxCollect:true},_dutyState:{fulfillment:90}}))}];c.P.time.daysPerTurn=30;c.GM.turn++;
 c._applyOfficeDutyTick(c.GM);const regions=c.GM.adminHierarchy.player.divisions;
 near(regions[0].fiscal.compliance,.505,'tax duty has shared workload in its own region');near(regions[1].fiscal.compliance,.5,'tax duty does not affect unrelated region');near(regions[1].corruption,19.5,'supervision duty keeps its own scope and workload');near(regions[0].corruption,20,'supervision does not leak to tax jurisdiction');
 near(c.FiscalEngine.adjustPlayerCompliance('',.1,.1,1,{regionId:'missing',regionName:'甲地'}),0,'invalid jurisdiction ID cannot fall back to a name or the whole realm');near(regions[0].fiscal.compliance,.505,'invalid scope does not mutate finance');
}
console.log('PASS office-duty-integration '+checks+' assertions');
