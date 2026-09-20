import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.TM_TEST_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const overlay=process.env.TM_TEST_OVERLAY;
const read=f=>fs.readFileSync(overlay&&fs.existsSync(path.join(overlay,f))?path.join(overlay,f):path.join(root,f),'utf8');
const {functionSource}=(await import(pathToFileURL(path.join(root,'web/scripts/lib-perf-round1.js')))).default;
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' '+e.stack);}}
function harness(){
 const g={sid:'fixture',turn:5,playerInfo:{factionId:'own',factionName:'本朝'},
 chars:[{id:'a',name:'甲臣',alive:true,faction:'本朝',party:'旧党'},{id:'b',name:'乙臣',alive:true,faction:'本朝'},{id:'dead',name:'故臣',alive:false},{id:'player',name:'天子',alive:true,isPlayer:true,faction:'本朝'}],
 facs:[{id:'own',name:'本朝',isPlayer:true}],parties:[{id:'old',name:'旧党',leader:'甲臣',head:'甲臣',members:['甲臣']}],
 classes:[{id:'peasants',name:'编户农民',populationKeys:['farmers']}],population:{national:{mouths:1000},byClass:{farmers:{mouths:1000,households:200,ding:250}}},
 armies:[{id:'old-army',name:'旧禁军',commander:'甲臣',faction:'本朝',soldiers:5000,strength:5000,size:5000,_createdTurn:1}],
 guoku:{money:100000,grain:100000},officeTree:[{id:'dept-old',name:'户部',positions:[{id:'pos-old',name:'尚书',holder:'甲臣',rank:'正二品'}],subs:[]}],_turnReport:[]};
 const c={console,GM:g,P:{conf:{},playerInfo:g.playerInfo},setTimeout(){},clearTimeout(){},_dbg(){},addEB(){},toast(){},findCharByName:n=>g.chars.find(c=>c.name===n)};
 c.window=c;c.globalThis=c;c._spends=[];c.FiscalEngine={spendFromGuoku(amounts){c._spends.push(amounts);const deducted={};for(const k of Object.keys(amounts)){g.guoku[k]-=amounts[k];deducted[k]={deducted:amounts[k],deficit:0};}return{ok:true,deducted};}};
 vm.createContext(c);
 for(const f of ['tm-social-formation.js','tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-office-creation.js','tm-office-reform.js','tm-endturn-agent-write-tools.js','tm-party-class-llm-calibrator.js','tm-personal-memory-recall.js','tm-live-context.js'])vm.runInContext(read('web/'+f),c,{filename:f});
 c.applyAIArmyChange=c.TM.AIChange.Army.applyAIArmyChange;
 return{g,c,S:c.TM.SocialFormation,W:c.TM.Endturn.AgentWriteTools};
}
await test('party creation links stable IDs, live members, leader and current UI facts',()=>{
 const h=harness(),r=h.S.createParty(h.g,{name:'新政党',leader:'a',members:['b'],ideology:'共议盐政',influence:0,cohesion:0,reason:'甲乙因盐政改革结盟'});
 assert(r.ok);assert(r.entity.id);assert.equal(r.entity.influence,0);assert.equal(r.entity.cohesion,0);assert.equal(r.entity.memberCount,2);
 assert.equal(h.g.chars[0].party,'新政党');assert.equal(h.g.chars[1].partyId,r.entity.id);assert.equal(h.g.parties[0].leader,'');
 assert(h.c.TM.LiveContext.publicFacts(h.g,h.g.chars[0],'新政党').includes('新政党'));assert(h.g.turnChanges.parties.some(p=>p.id===r.entity.id));
});
await test('duplicate party registration does not reset state or duplicate membership',()=>{
 const h=harness(),r=h.S.createParty(h.g,{name:'新政党',leader:'a',reason:'本局结盟'});r.entity.influence=37;
 const again=h.S.createParty(h.g,{name:'新政党',leader:'b',reason:'重传'});assert(again.duplicate);assert.equal(again.entity.influence,37);assert.equal(again.entity.leader,'甲臣');assert.equal(h.g.parties.length,2);
});
await test('unknown/dead founders and player reassignment fail before any group is inserted',()=>{
 for(const leader of ['不存在','dead','player']){const h=harness(),n=h.g.parties.length;const r=h.S.createParty(h.g,{name:'新政党',leader,reason:'测试'});assert(!r.ok);assert.equal(h.g.parties.length,n);assert.equal(h.g.chars[0].party,'旧党');}
});
await test('class emergence without population proof does not fabricate five percent of citizens',()=>{
 const h=harness(),r=h.S.createClass(h.g,{name:'新式技工',size:'约5%',economicRole:'工场技术',origin:'工场增长',satisfaction:0,influence:0});
 assert(r.ok);assert(r.entity.id);assert.equal(r.entity.satisfaction,0);assert.equal(r.entity.influence,0);assert(r.entity._populationPending);
 assert.equal(h.g.population.national.mouths,1000);assert.equal(Object.values(h.g.population.byClass).reduce((a,b)=>a+b.mouths,0),1000);
});
await test('specified class reclassification conserves population, households and adult men',()=>{
 const h=harness(),r=h.S.createClass(h.g,{name:'新式技工',economicRole:'工场技术',fromClass:'peasants',populationCount:200,reason:'二百农民转入工场'});
 assert(r.ok);assert.equal(h.g.population.byClass.farmers.mouths,800);assert.equal(h.g.population.byClass[r.entity.id].mouths,200);
 for(const [field,total]of [['mouths',1000],['households',200],['ding',250]])assert.equal(Object.values(h.g.population.byClass).reduce((a,b)=>a+b[field],0),total);
 const before=JSON.stringify(h.g.population);assert(!h.S.createClass(h.g,{name:'超额阶层',fromClass:'peasants',populationCount:5000,reason:'测试'}).ok);assert.equal(JSON.stringify(h.g.population),before);
});
await test('same-batch new class can become the social base of a newly formed party',()=>{
 const h=harness(),out=h.S.apply(h.g,{classEmerge:[{name:'工场匠人',economicRole:'工场',reason:'工场扩大'}],partyCreate:[{name:'工学党',socialBase:[{class:'工场匠人',affinity:.7}],reason:'围绕工场议题结社'}]});
 assert(out.classes[0].ok);assert(out.parties[0].ok);assert.equal(out.parties[0].entity.socialBase[0].classId,out.classes[0].entity.id);
});
await test('new army with the same commander is distinct from the existing army',()=>{
 const h=harness(),r=h.c.applyAIArmyChange({name:'新禁军',action:'create',commander:'甲臣',soldiers:1000,faction:'本朝'},{source:'edict.build_army'});
 assert(r.ok&&r.created);assert.equal(h.g.armies.length,2);assert.equal(h.g.armies[0].soldiers,5000);assert.equal(r.army.soldiers,1000);assert.equal(h.c._spends.length,1);
});
await test('similar names and repeated create requests do not merge formations or double charge',()=>{
 const h=harness(),change={name:'旧禁军新营',action:'create',soldiers:500,faction:'本朝'},r=h.c.applyAIArmyChange(change,{source:'edict.build_army'});
 assert(r.created);const balance=h.g.guoku.money;const again=h.c.applyAIArmyChange(change,{source:'edict.build_army'});assert(again.duplicate);assert.equal(h.g.guoku.money,balance);assert.equal(h.g.armies[0].soldiers,5000);
});
await test('Agent exposes and executes social creation while generic append stays restricted',async()=>{
 const h=harness(),names=h.W.defs().map(x=>x.name);for(const n of ['form_party','emerge_class','create_office'])assert(names.includes(n));
 const r=await h.W.handle('form_party',{name:'新政党',leader:'a',members:['b'],reason:'议政结盟'},{GM:h.g});assert(r.ok&&r.changed);assert(h.g._agentWriteLog.some(x=>x._op==='form_party'));
 const bad=await h.W.handle('push_field',{path:'parties',value:{name:'越过写口'}},{GM:h.g,meta:{enforceSemanticWrites:true}});assert(!bad.ok);
});
await test('Agent creates real departments and positions without appointing their first holder',async()=>{
 const h=harness();h.c.officeFlagOn=()=>false;
 const r=await h.W.handle('create_office',{action:'create_department',dept:'工学司',positions:[{name:'主事',rank:'正六品',establishedCount:2}],reason:'新设工学司'},{GM:h.g});
 assert(r.ok&&r.changed);const dept=h.g.officeTree.find(x=>x.name==='工学司');assert(dept.id);assert.equal(dept.positions[0].holder,'');assert.equal(dept.positions[0].establishedCount,2);
 const p=await h.W.handle('create_office',{action:'create_position',dept:'工学司',position:'司丞',rank:'正七品',reason:'增职'},{GM:h.g});assert(p.ok);assert(dept.positions.some(x=>x.name==='司丞'));
});
await test('office adjudication remains a pending proposal, not a fake completed department',async()=>{
 const h=harness();h.c.officeFlagOn=()=>true;
 const r=await h.W.handle('create_office',{action:'create_department',dept:'新政司',reason:'新设'},{GM:h.g});assert(r.ok);assert(r.result.deferred);assert(!r.verified);assert(!h.g.officeTree.some(x=>x.name==='新政司'));assert(h.g._pendingReforms.some(x=>x.dept==='新政司'));
});
await test('party/class calibration can create new names and link them within one response',()=>{
 const h=harness(),C=h.c.TM.PartyClassLlmCalibrator;
 const prompt=JSON.stringify(C.buildMessages(C.buildSnapshot(h.g)));assert(prompt.includes('party_create'));assert(prompt.includes('class_emerge'));
 const out=C.applyResult(h.g,{class_emerge:[{name:'实学工匠',economicRole:'新工场',origin:'工場扩大',reason:'生产方式变化'}],party_create:[{name:'实学党',leader:'甲臣',members:['乙臣'],socialBase:[{class:'实学工匠'}],reason:'实学议题持续结盟'}]});
 assert(h.g.classes.some(c=>c.name==='实学工匠'));assert(h.g.parties.some(p=>p.name==='实学党'));assert(out);
});
await test('actual SC1 normalizer accepts creation aliases then actual apply section registers them',()=>{
 const h=harness(),ai=read('web/tm-endturn-ai.js');
 vm.runInContext(['_hasExpectedJsonKey','_normalizeParsedJsonForExpected'].map(n=>functionSource(ai,n)).join('\n'),h.c);
 const p=h.c._normalizeParsedJsonForExpected({shizhengji:'测试',new_parties:[{name:'新政党',leader:'甲臣',reason:'议政结盟'}],classEmerge:[{name:'实学工匠',economicRole:'工场',reason:'生产变化'}]},['shizhengji']);
 assert(Array.isArray(p.party_create));assert(Array.isArray(p.class_emerge));h.c.p1=p;
 const s=read('web/tm-endturn-apply.js'),a=s.indexOf('        // ── 新群体形成'),b=s.indexOf('        // ── 党派覆灭',a);assert(a>=0&&b>a);
 vm.runInContext(s.slice(a,b),h.c);assert(h.g.parties.some(p=>p.name==='新政党'));assert(h.g.classes.some(c=>c.name==='实学工匠'));
});
await test('class finalization and save round-trip retain new IDs and do not create extra population',()=>{
 const h=harness(),c=h.S.createClass(h.g,{name:'实学工匠',reason:'工場扩大'}).entity;
 vm.runInContext(read('web/tm-class-engine.js'),h.c);h.c.TM.ClassEngine.ensureClassPopulationCell(c,h.g);
 assert.equal(h.g.population.byClass[c.id].mouths,0);const save=JSON.parse(JSON.stringify(h.g));
 assert.equal(save.classes.find(x=>x.name===c.name).id,c.id);assert.equal(Object.values(save.population.byClass).reduce((n,r)=>n+r.mouths,0),1000);
});
await test('empty office tree can receive its first department and creation replay is idempotent',async()=>{
 const h=harness();delete h.g.officeTree;const r=await h.W.handle('create_office',{action:'create_department',dept:'新政司',positions:[{name:'主事'}],reason:'设署'},{GM:h.g});assert(r.ok);
 const again=await h.W.handle('create_office',{action:'create_department',dept:'新政司',positions:[{name:'主事'}],reason:'重传'},{GM:h.g});assert(again.ok&&!again.changed);assert.equal(h.g.officeTree.length,1);
});
await test('formation errors stay visible instead of being counted as created',()=>{
 const h=harness(),r=h.S.createParty(h.g,{name:'无成员团体',reason:'资料不足'});assert(!r.ok);assert(h.g._entityFormationFailures.some(x=>x.name==='无成员团体'));assert(!h.g._turnReport.some(x=>x.name==='无成员团体'));
});
await test('pending class estimates do not become fabricated population when a population model appears later',()=>{
 const h=harness();delete h.g.population;const r=h.S.createClass(h.g,{name:'新式技工',size:'约5%',reason:'生产变化'});assert(r.ok);
 h.g.population={national:{mouths:1000},byClass:{farmers:{mouths:1000}}};vm.runInContext(read('web/tm-class-engine.js'),h.c);
 h.c.TM.ClassEngine.ensureClassPopulationCell(r.entity,h.g);assert.equal(h.g.population.byClass[r.entity.id].mouths,0);
});
await test('inconsistent population binding and transfer input cannot mutate either ledger',()=>{
 const h=harness(),before=JSON.stringify(h.g.population);const r=h.S.createClass(h.g,{name:'新阶层',populationKeys:['farmers'],populationCount:200,fromClass:'peasants',reason:'重分类'});
 assert(!r.ok);assert.equal(JSON.stringify(h.g.population),before);assert.equal(h.g.classes.length,1);
});
await test('empty office feedback does not require a previously existing office tree',()=>{
 const s=read('web/tm-endturn-apply.js');assert(s.includes('Array.isArray(p1.office_changes) && p1.office_changes.length'));
});
await test('formation records feed the involved character memory and court chronicle once',()=>{
 const h=harness(),events=[],mem=[];h.c.TM.Qiju={recordEntry:e=>events.push(e)};h.c.NpcMemorySystem={remember:(...args)=>mem.push(args)};
 const row={name:'新党',leader:'甲臣',reason:'共议革新'};const out=h.S.createParty(h.g,row);h.S.createParty(h.g,row);
 assert(out.ok);assert.equal(events.length,1);assert.equal(mem.length,1);assert.equal(mem[0][0],'甲臣');assert.equal(h.g.parties[0].memberCount,0);
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
