#!/usr/bin/env node
'use strict';
// Production modules in detached fixtures. No network, no campaign turn, no live GM/P.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const WEB=path.resolve(__dirname,'..');let checks=0;
const clone=v=>JSON.parse(JSON.stringify(v));
function ok(v,m){checks++;assert.ok(v,m)}
function eq(a,b,m){checks++;assert.strictEqual(a,b,m)}
function same(a,b,m){checks++;assert.deepStrictEqual(clone(a),clone(b),m)}
function fixture(options={}){
 const math=Object.create(Math),events=[],elements=[],net=[];let randomCalls=0;
 math.random=()=>{randomCalls++;return 0;};
 const s={console:{log(){},warn(){},error(e){throw e}},Math:math,Date,JSON,RegExp,Error,Array,Object,String,Number,Boolean,parseInt,parseFloat,isNaN,isFinite,
  setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},addEB(...args){events.push(args)},toast(){},
  fetch(...args){net.push(args);throw Error('network forbidden')},XMLHttpRequest(){throw Error('network forbidden')},
  document:{createElement(){const e={style:{},innerHTML:'',addEventListener(){},remove(){}};elements.push(e);return e;},body:{appendChild(){}},getElementById(){return null},querySelectorAll(){return []}}
 };
 s.window=s;s.global=s;s.globalThis=s;s.TM={errors:{capture(e){throw e},captureSilent(e){throw e}}};
 const pm={characterId:'q',name:'仇士良',factionId:'tang',mode:options.mode||'institutional',innerCourt:true,controlLevel:.62,officeIds:['office-q'],associates:[{characterId:'y',officeId:'office-y'}],description:'两军各有掌事者，传诏须交到营门。',extraSeed:{kept:true}};
 if(options.zeroControl)pm.controlLevel=0;
 s.P={id:'test',playerInfo:{factionId:'tang'},conf:{},authorityConfig:{accounting:{schema:'tm-authority-ledger/2'},initial:{huangquan:42,huangwei:53,huangquanSubDims:{central:62,provincial:42,military:28,imperial:24}}}};
 if(options.seed!==false)s.P.authorityConfig.initial.powerMinister=pm;
 s.GM={sid:'test',turn:1,playerInfo:{factionId:'tang'},facs:[{id:'tang',name:'唐朝廷'},{id:'foreign',name:'外国'}],
  chars:[{id:'q',name:'仇士良',faction:'tang',alive:true,courtRole:'eunuch',role:'左神策军中尉',officialTitle:'左神策军中尉',rankLevel:12,ambition:71},
   {id:'y',name:'鱼弘志',faction:'tang',alive:true,courtRole:'eunuch',role:'右神策军中尉',officialTitle:'右神策军中尉',rankLevel:12,ambition:67},
   {id:'m',name:'外朝官',faction:'tang',alive:true,role:'minister',officialTitle:'尚书',rankLevel:3,ambition:95},
   {id:'x',name:'外国执政',faction:'foreign',alive:true,courtRole:'regent',officialTitle:'摄政',rankLevel:1,ambition:95}],
  officeTree:[{id:'department',positions:[{id:'office-q',name:'左神策军中尉',holder:'仇士良',holderId:'q',rankLevel:5,authority:'decision',powers:{militaryCommand:true}},
   {id:'office-y',name:'右神策军中尉',holder:'鱼弘志',holderId:'y',rankLevel:5,powers:{militaryCommand:true}},
   {id:'office-m',name:'尚书',holderId:'m',rankLevel:3,powers:{supervise:true}}]}],
  armies:[{id:'army-left',faction:'tang',commandChain:{mode:'receipt',custodians:[{characterId:'q',officeId:'office-q'}]}},
   {id:'army-right',faction:'tang',commandChain:{mode:'receipt',custodians:[{characterId:'y',officeId:'office-y'}]}},
   {id:'army-foreign',faction:'foreign',commandChain:{mode:'receipt',custodians:[{characterId:'x'}]}}],
  guoku:{money:5000000,grain:4000000,cloth:1000000},neitang:{money:650000,grain:90000,cloth:85000},partyStrife:20,settings:{},classes:[],population:{national:{mouths:1000}},evtLog:[],_turnReport:[]};
 if(options.precreated)s.GM.huangquan={index:42,powerMinister:null};
 s.findScenarioById=id=>id===s.P.id?s.P:null;vm.createContext(s);
 for(const f of ['tm-authority-engines.js','tm-authority-complete.js','tm-prophecy.js','tm-authority-deep.js','tm-region-enrich.js','tm-event-bus.js','tm-player-tools.js','tm-conspiracy.js','tm-world-digest.js','tm-ai-npc-memorials.js'])vm.runInContext(fs.readFileSync(path.join(WEB,f),'utf8'),s,{filename:f});
 if(options.init!==false){s.AuthorityEngines.init();s.AuthorityComplete.init();}
 return {s,events,elements,net,randomCalls:()=>randomCalls,resetRandom(){randomCalls=0}};
}
function withoutDraft(G){const a=clone(G);delete a._edictSuggestions;return a;}

{
 const {s,net}=fixture({zeroControl:true}),pm=s.GM.huangquan.powerMinister;
 eq(pm.mode,'institutional','initial mode survives initialization');eq(pm.innerCourt,true,'inner-court identity survives initialization');eq(pm.controlLevel,0,'explicit zero control is preserved');
 same(pm.officeIds,['office-q'],'initial office IDs retained');same(pm.associates,[{characterId:'y',officeId:'office-y'}],'initial associates retained');ok(pm.extraSeed.kept,'additional authored fields retained');
 pm.controlLevel=.74;pm.associates.push({characterId:'m'});s.AuthorityEngines.init();eq(s.GM.huangquan.powerMinister.controlLevel,.74,'reinitialization keeps evolved control');eq(s.GM.huangquan.powerMinister.associates.length,2,'reinitialization keeps evolved associates');
 s.GM.huangquan.powerMinister=null;s.AuthorityEngines.init();eq(s.GM.huangquan.powerMinister,null,'cleared state cannot be reseeded at turn one');eq(s.AuthorityComplete.detectPowerMinister({turn:1}),null,'declared institutional policy never creates a replacement random minister');
 eq(s.P.authorityConfig.initial.powerMinister.controlLevel,0,'scenario seed was cloned');eq(net.length,0,'init performs no network call');
}
{
 const {s}=fixture({precreated:true});eq(s.GM.huangquan.powerMinister.characterId,'q','precreated core authority object receives authored opening state');
 const f=fixture({init:false});delete f.s.findScenarioById;f.s.AuthorityEngines.init();eq(f.s.GM.huangquan.powerMinister.characterId,'q','scenario P fallback seeds the opening state');
 const late=fixture({init:false});late.s.GM.turn=8;late.s.GM.huangquan={index:47};late.s.AuthorityEngines.init();eq(late.s.GM.huangquan.powerMinister,undefined,'older ongoing save is not newly seeded');
}
{
 const {s}=fixture(),A=s.AuthorityEngines,G=s.GM,q=G.chars[0],before=clone(G);
 let result=A.readPowerMinisterEligibility(q,G);ok(result.eligible,'explicit courtRole and occupied military post qualify');eq(result.rankLevel,5,'actual occupied rank beats stale character rank 12 without promotion module');eq(result.innerCourt,true,'Chinese role title does not hide explicit identity');same(G,before,'eligibility read is pure');
 q.role='eunuch';delete q.courtRole;ok(A.readPowerMinisterEligibility(q,G).eligible,'legacy role enum remains supported');q.role='左神策军中尉';ok(!A.readPowerMinisterEligibility(q,G).eligible,'Chinese official title alone does not infer eunuch status');q.courtRole='eunuch';
 G.officeTree[0].positions[0].rankLevel=9;ok(!A.readPowerMinisterEligibility(q,G).eligible,'low-ranked eunuch is not broadened into a candidate by title');
 G.officeTree[0].positions[0].rankLevel=5;G.officeTree[0].positions[0].powers={};delete G.officeTree[0].positions[0].authority;ok(!A.readPowerMinisterEligibility(q,G).eligible,'rank alone is insufficient without office powers');
 G.officeTree[0].positions[0].powerMinisterEligible=true;ok(A.readPowerMinisterEligibility(q,G).eligible,'explicit institutional eligibility can designate special offices');
 ok(!A.readPowerMinisterEligibility(G.chars[2],G).eligible,'ordinary supervising official does not qualify');ok(!A.readPowerMinisterEligibility(G.chars[3],G).active,'other-realm character cannot retain player-side power');
 q.alive=false;ok(!A.readPowerMinisterStatus(G.huangquan.powerMinister,G).active,'death overrides a stale military custody row');
}
{
 const {s}=fixture(),G=s.GM,A=s.AuthorityEngines,C=s.AuthorityComplete;
 G.chars[0].name='更名掌事者';G.chars.push({id:'duplicate',name:'仇士良',faction:'tang',alive:true});C.reconcilePowerMinister();eq(G.huangquan.powerMinister.name,'更名掌事者','stable ID resolves rename despite duplicate original name');
 G.officeTree[0].positions[0].holderId='m';G.officeTree[0].positions[0].holder='外朝官';G.chars[0].officialTitle='致仕';C.reconcilePowerMinister();ok(G.huangquan.powerMinister,'nominal removal retains actual custody until handover');
 const status=A.readPowerMinisterStatus(G.huangquan.powerMinister,G);eq(status.evidence,'confirmed-command','actual retained command is explicit evidence');
 G.armies[0].commandChain.custodians=[{id:'m',title:'新掌事者',acceptedTurn:2}];C.reconcilePowerMinister();eq(G.huangquan.powerMinister,null,'accepted custody replacement plus office removal ends old power state');
 s.P.conf.powerMinisterEnabled=true;G.chars[1]._tenureMonths=30;eq(C.detectPowerMinister({turn:2}),null,'remaining associate is not auto-selected as an institutional successor');
}
{
 const a=fixture();a.s.GM.chars[0].faction='foreign';a.s.AuthorityComplete.reconcilePowerMinister();eq(a.s.GM.huangquan.powerMinister,null,'change to another realm ends player-side PM state');
 const b=fixture();b.s.GM.chars[0].alive=false;b.s.AuthorityComplete.reconcilePowerMinister();eq(b.s.GM.huangquan.powerMinister,null,'dead incumbent is removed');
 const c=fixture();delete c.s.GM.officeTree;c.s.GM.armies=[];const p=c.s.GM.huangquan.powerMinister;c.s.AuthorityComplete.reconcilePowerMinister();eq(c.s.GM.huangquan.powerMinister,p,'loading without offices leaves pending seed intact');ok(c.s.AuthorityEngines.readPowerMinisterStatus(p,c.s.GM).pending,'read status states dependency pending');
 c.s.GM.officeTree=[];c.s.AuthorityComplete.reconcilePowerMinister();eq(c.s.GM.huangquan.powerMinister,null,'known empty office registry is genuine loss of power');
 const d=fixture();d.s.GM.chars.push({id:'q2',name:'仇士良',alive:true,faction:'tang'});delete d.s.GM.huangquan.powerMinister.characterId;eq(d.s.AuthorityEngines.readPowerMinisterStatus(d.s.GM.huangquan.powerMinister,d.s.GM).active,false,'ambiguous names are not guessed');
}
{
 const f=fixture(),{s}=f,G=s.GM;G.huangquan.index=10;G.huangquan.powerMinister.controlLevel=.99;G._pendingMemorials=[{id:'memo',status:'drafted'}];G.chars[1]._impressions={'仇士良':{favor:100}};s.P.conf.powerMinisterEnabled=true;
 const before=clone(G);f.resetRandom();s.AuthorityComplete.tickPowerMinister({turn:20},12);same(G,before,'institutional PM consumes no monthly auto growth, interception, allies or usurpation');eq(f.randomCalls(),0,'institutional state never rolls random PM outcomes');
 const options=[{route:'integrity'},{route:'patronage'},{route:'diplomacy'},{route:'test'}];eq(s.filterQueryOptionsByPhase(options),options,'institutional state never hides valid player options');
 const end=s.AuthorityComplete.powerMinisterEndgame({name:'仇士良',innerCourt:true},'usurpation',{turn:20});ok(end.requiresResolution,'direct legacy endgame cannot bypass current institutional mode');same(G,before,'endgame guard leaves all campaign state intact');
 delete G.huangquan.powerMinister.mode;s.AuthorityComplete.reconcilePowerMinister();eq(G.huangquan.powerMinister.mode,'institutional','saved institutional policy repairs a partial PM replacement that dropped its mode');s.AuthorityComplete.tickPowerMinister({turn:20},12);eq(G.huangquan.powerMinister.controlLevel,.99,'lost optional field cannot reactivate monthly random growth');
 eq(s.PhaseF2.EVENT_DEFS.find(d=>d.id==='authority.powerMinister.rise').test(G),false,'opening condition is not announced as a new random rise');
}
{
 const f=fixture(),{s}=f,G=s.GM,before=withoutDraft(G);f.resetRandom();
 const ids=Object.keys(s.PhaseD.COUNTER_STRATEGIES);eq(ids.length,7,'all seven existing actions are retained');
 for(const id of ids){
  const r=s.PhaseD.invokeCounterStrategy(id);ok(r.proposed&&r.applied===false,'public '+id+' is an unsubmitted draft');same(withoutDraft(G),before,id+' changes no money, control, office, life or pressure');
  const d=s.PhaseD.COUNTER_STRATEGIES[id].effect(G);ok(d.proposed&&d.applied===false,'direct '+id+' obeys the same guard');eq(d.suggestionId,r.suggestionId,id+' repeated intent is deduplicated');
 }
 eq(G._edictSuggestions.length,7,'seven distinct intents remain available');eq(f.randomCalls(),0,'draft actions do not roll outcome dice');
 const r=s.PhaseF1.rotateOfficialsWithDecay('仇士良');ok(r.proposed,'old rotation shim also becomes a draft');
 const secret=s.PhaseF4.dispatchSecretEdict('外朝官','查验','请于五日内查验印信，覆奏军籍。');ok(secret.proposed&&secret.applied===false,'secret edict is drafted without fictional delivery');ok(secret.content.includes('外朝官')&&secret.content.includes('五日内查验印信'),'draft retains intended recipient and content');ok(!G._secretEdicts,'no delivered-secret-edict ledger fabricated');
 for(const action of ['purge','execute','exile']){const r=s.AuthorityComplete.handleCrisisAction({type:'power_minister',action,targetName:'仇士良'});ok(r.proposed&&r.applied===false,'crisis '+action+' is an intent');}
 ok(s.AuthorityEngines.executePurge('仇士良').proposed,'direct purge is also an intent');
 const surface=s.AuthorityComplete.handleCrisisSurfaceResponse({channel:'memorial',crisisAction:{type:'power_minister',action:'purge'},targetName:'仇士良',text:'查问仇士良所掌军籍'});ok(surface.proposed,'existing crisis surface preserves draft semantics');
 same(withoutDraft(G),before,'no countermeasure fabricated effects or an action-success report');eq(f.net.length,0,'no AI or network request from drafts');
}
{
 const {s,elements}=fixture(),G=s.GM,before=clone(G);G.huangquan.powerMinister.description='<img src=x onerror=fail>两军分掌';const changed=clone(G);
 s.PhaseF5.openPowerCounterUI();const html=elements[elements.length-1].innerHTML;ok(html.includes('职掌与交接'),'UI presents actual institutional context');ok(html.includes('拟入诏意'),'UI explains the draft action');eq((html.match(/PhaseD.invokeCounterStrategy/g)||[]).length,7,'all seven actionable entries remain');ok(!html.includes('控制力')&&!html.includes('厂卫'),'institutional UI removes imaginary control percentage and era-bound labels');ok(html.includes('&lt;img')&&!html.includes('<img src=x'),'authored text is HTML escaped');same(G,changed,'rendering has no campaign writes');
 const a=s.PhaseB.assessMilitaryPower(G);eq(a.holder,'institutional','military assessment takes actual custody branch');eq(a.risk,null,'no fabricated universal risk probability');same(a.controllers.map(c=>c.characterId),['q','y'],'only same-realm actual custodians are listed');same(a.controllers.find(c=>c.characterId==='q').armyIds,['army-left'],'PM controls only the recorded army');same(G,changed,'military assessment remains pure');
 G.chars[0].alive=false;ok(!s.PhaseB.assessMilitaryPower(G).controllers.some(c=>c.characterId==='q'),'dead custodian excluded from military summary');
 ok(s.AuthorityComplete.getExtendedAIContext().includes('职掌与交接'),'main authority context uses institutional presentation');
}
{
 const {s}=fixture({seed:false}),G=s.GM;delete G.officeTree;G.armies=[];G.chars=[{id:'old',name:'旧制近侍',role:'eunuch',officialTitle:'近侍长官',rankLevel:2,alive:true,_tenureMonths:24,ambition:80}];
 eq(s.AuthorityComplete.isPowerMinisterEnabled(),false,'legacy random-system setting remains off by default');s.AuthorityComplete.tickOfficeTenure({turn:1},1);eq(G.chars[0]._tenureMonths,24,'off switch still stops tenure accumulation');
 s.P.conf.powerMinisterEnabled=true;s.AuthorityComplete.tickOfficeTenure({turn:1},1);eq(G.chars[0]._tenureMonths,25,'legacy explicit switch still enables tenure accumulation');
 const pm=s.AuthorityComplete.detectPowerMinister({turn:1});ok(pm&&pm.innerCourt,'legacy role enum and title-only old saves still qualify');G.huangquan.index=55;s.AuthorityComplete.tickPowerMinister({turn:1},1);ok(pm.controlLevel>.3,'legacy monthly growth remains unchanged');
 const before=pm.controlLevel;s.PhaseD.invokeCounterStrategy('secret_edict');ok(pm.controlLevel<before,'legacy strategy keeps existing adjudication');
 G.chars[0].officialTitle='致仕';s.AuthorityComplete.reconcilePowerMinister();eq(G.huangquan.powerMinister,null,'legacy retired minister no longer survives merely because alive');
}
{
 const {s}=fixture();vm.runInContext('AuthorityEngines=undefined;',s);const before=clone(s.GM);
 ok(s.PhaseD.COUNTER_STRATEGIES.execute_power_minister.effect(s.GM).requiresResolution,'low-level strategy fails closed without draft writer');
 ok(s.AuthorityComplete.handleCrisisAction({type:'power_minister',action:'execute'}).requiresResolution,'low-level crisis fails closed without draft writer');
 ok(s.PhaseF4.dispatchSecretEdict('外朝官','查验','查验军籍').requiresResolution,'low-level secret edict fails closed without draft writer');
 ok(s.AuthorityComplete.powerMinisterEndgame({name:'仇士良'},'usurpation',{}).requiresResolution,'global institutional PM blocks separate endgame request without helper');same(s.GM,before,'missing helper never makes direct effects reappear');
}

{
 const {s,events}=fixture(),G=s.GM,plot={id:'palace',kind:'palace_coup',ringleader:'仇士良',target:'君主',momentum:120,exposure:0,stage:'ripe',_ripeSince:0};G.turn=4;G.huangwei.index=10;G.huangquan.index=10;G._activePlots=[plot];
 const chars=clone(G.chars),treasury=clone(G.guoku);
 eq(s.ConspiracyEngine._resolve(G,plot),false,'institutional palace plot cannot be auto-completed by low authority');ok(plot._resolutionPending,'unresolved palace action is retained for actual evidence and disposition');ok(!G._conspiracies||!G._conspiracies.length,'no fabricated success entered conspiracy history');
 const r=s.ConspiracyEngine._resolveRipe(G,plot);ok(r.requiresResolution,'direct ripe-resolution path also defers');G.huangwei.index=90;G.huangquan.index=90;plot.exposure=120;eq(s.ConspiracyEngine._resolve(G,plot),false,'high authority or generic exposure cannot substitute for an actual arrest');
 same(G.chars,chars,'pending suspicion never imprisons or kills anyone');same(G.guoku,treasury,'pending suspicion never changes treasury');ok(!events.some(e=>/宫变得逞|事败就擒/.test(e[1])),'no false victory or arrest announcement');ok(s.ConspiracyEngine.aiContextBlock(G).includes('不得先叙为废立得逞'),'pending context explicitly preserves unresolved state');
 const b=fixture({mode:'legacy'}),H=b.s.GM;H.turn=4;H.huangwei.index=10;H.huangquan.index=10;b.s.AuthorityComplete.powerMinisterEndgame=()=>({ok:false,requiresResolution:true,reason:'missing receipt'});
 const p={id:'blocked-legacy-call',kind:'palace_coup',ringleader:'仇士良',target:'君主',momentum:120,exposure:0,stage:'ripe',_ripeSince:0};
 ok(b.s.ConspiracyEngine._resolveRipe(H,p).requiresResolution,'caller respects endgame refusal even outside institutional policy');eq(b.s.ConspiracyEngine._resolve(H,p),false,'timeout resolution keeps a refused action active');ok(!H._conspiracies||!H._conspiracies.length,'refused endgame never enters success history');ok(!b.events.some(e=>/宫变得逞/.test(e[1])),'refused endgame is never announced successful');
}
{
 const {s}=fixture(),G=s.GM,before=clone(G),rows=s.WorldDigest.previewData(G),observation=rows.find(r=>r.kind==='institutional');ok(observation,'digest retains institutional situation as an observation');eq(observation.sev,0,'opening office is not assigned a fabricated urgent crisis severity');ok(observation.line.includes('左神策军中尉')&&observation.line.includes('1军'),'digest names actual office and bounded custody');
 const block=s.WorldDigest.previewBlock(G);ok(block.includes('现任职掌'),'institutional-only digest uses a factual heading');ok(!/坐大|架空|若不干预/.test(block),'opening office does not manufacture a mandatory future crisis');
 const scene=s.NpcMemorials.buildNpcSceneContext();ok(scene.includes('现任职掌')&&scene.includes('左神策军中尉'),'NPC context uses real office evidence');ok(!scene.includes('权重 0'),'missing legacy weight is never fabricated');same(G,before,'digest and NPC scene builders are read only');
 G.huangquan.powerMinister.mode='legacy';const legacy=s.WorldDigest.previewData(G);ok(legacy.some(r=>r.sev===78&&r.line.includes('坐大')),'legacy warning behavior remains');ok(!s.NpcMemorials.buildNpcSceneContext().includes('权重 0'),'missing legacy weight is also omitted');G.huangquan.powerMinister.weight=0;ok(s.NpcMemorials.buildNpcSceneContext().includes('权重 0'),'an explicitly authored zero weight remains visible');
}

// The current scenario data is a separate, optional witness; generic fixture coverage remains portable.
const file=path.resolve(WEB,'../scenarios/晚唐·开成五年（官方）.json');
if(fs.existsSync(file)){
 const sc=JSON.parse(fs.readFileSync(file,'utf8')),seed=sc.authorityConfig&&sc.authorityConfig.initial&&sc.authorityConfig.initial.powerMinister;
 if(seed&&seed.mode==='institutional'){
  const {s}=fixture(),G={sid:sc.id,turn:1,playerInfo:clone(sc.playerInfo),chars:clone(sc.characters),facs:clone(sc.factions),officeTree:clone(sc.officeTree),armies:clone(sc.military.initialTroops||[]),huangquan:{powerMinister:clone(seed)}};
  const q=s.AuthorityEngines.readPowerMinisterStatus(G.huangquan.powerMinister,G);ok(q.active&&q.innerCourt,'authored Tang Qiu is active by explicit identity and actual offices');eq(q.rankLevel,5,'production Tang Qiu reads rank five from occupied post');ok(q.armyIds.length>0,'production Tang Qiu has actual military custody evidence');
  const fish=G.chars.find(c=>c.name==='鱼弘志'),f=s.AuthorityEngines.readPowerMinisterEligibility(fish,G);ok(f.eligible&&f.innerCourt,'production Tang Yu is independently identified');ok(f.armyIds.length>0,'production Tang Yu retains independent custody');
  const snapshot=clone(G);s.AuthorityEngines.readPowerMinisterStatus(G.huangquan.powerMinister,G);same(G,snapshot,'production-data review is read only');
 }
}
console.log('PASS institutional power minister: '+checks+' assertions; real module functions in detached fixtures, no AI or campaign turn.');
