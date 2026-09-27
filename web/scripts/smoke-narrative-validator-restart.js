'use strict';
const assert=require('assert/strict');
const {writer,baseGM,load,run}=require('./lib-player-error-regression');
const {pathToFileURL}=require('url'),path=require('path');
const tests=[],test=(name,fn)=>tests.push({name,fn});
const nonEvents=[
 '八月壬午，上即位初握乾纲。',
 '袁崇焕亦自东莞驰驿北上。',
 '收摄海外交涉纳款之权。',
 '延绥镇营兵因苦饥脱伍八百余人，聚山入寇之势滋蔓。',
 '西北秦中灾异彻闻于内，陕西延安、庆阳赤地千里。',
 '胡廷宴降为正四品，留任待勘。',
 '胡廷宴贬为知县。',
 '近臣奉命出宫查访民情。',
 '友人赠送书籍。',
 '陕西原有流民一万二千人，本月并无新增逃户。',
 '本月未出兵，下月计划北伐。',
 '去年日食，本月翻阅旧档。'
];
for(const text of nonEvents)test('live narrative does not invent a new event: '+text,()=>{
 const c=writer();load(c,'tm-number-parser.js');c.GM=baseGM({custom:{score:10}});
 const result=c.applyAITurnChanges({_strictValidation:true,shizhengji:text,changes:[{path:'custom.score',delta:5}]});
 assert(result.ok,JSON.stringify(result.applied.failed));assert.equal(c.GM.custom.score,15);
 for(const key of ['_populationValidatorLog','_warValidatorLog','_omenValidatorLog','_marriageBirthValidatorLog','_courtCeremonyValidatorLog','_diplomacyValidatorLog'])assert(!c.GM[key]?.length,key+' falsely classified '+text);
});
for(const text of ['本月正式开战。','今日出现日食。','今日新帝即位。','本月废后。','本月晋爵。'])test('narrative-only event is retained for review without inventing world state: '+text,()=>{
 const c=writer();c.GM=baseGM({custom:{score:10}});const chars=JSON.stringify(c.GM.chars);const r=c.applyAITurnChanges({_strictValidation:true,shizhengji:text,changes:[{path:'custom.score',delta:5}]});assert(r.ok);assert.equal(c.GM.custom.score,15);assert.equal(JSON.stringify(c.GM.chars),chars);assert(Object.keys(c.GM).some(k=>/ValidatorLog$/.test(k)&&c.GM[k].some(x=>x.warnings?.length)));
});
test('court rank accepts the actual updates shape and landed title value',()=>{
 const c=writer();c.GM=baseGM({chars:[{id:'a',name:'甲',alive:true,title:'伯'}]});const r=c.applyAITurnChanges({_strictValidation:true,shizhengji:'甲本月晋爵。',char_updates:[{characterId:'a',name:'甲',updates:{title:'侯'}}]});assert(r.ok,JSON.stringify(r.applied.failed));assert.equal(c.GM.chars[0].title,'侯');
});
async function validators(){const c=writer();load(c,'tm-number-parser.js');const {createValidators}=await import(pathToFileURL(path.join(__dirname,'../modules/ai-change-applier/validators.js')));return createValidators({global:c,core:{}});}
for(const [text,count]of [['一万二千',12000],['十二万',120000],['2万',20000],['两千',2000]])test('population count uses shared number semantics: '+text,async()=>{
 const v=await validators(),g=baseGM();v._validatePopulationConsistency(g,{shizhengji:'百姓逃亡'+text+'人。'},{});assert.equal(g._populationValidatorLog[0].warnings[0].mentioned,count);
});
test('population checks actual path and label receipts, not an obsolete name field',async()=>{
 const v=await validators(),g=baseGM({turnChanges:{variables:[{path:'population.fugitives',label:'流民',delta:12000}]}});v._validatePopulationConsistency(g,{shizhengji:'百姓逃亡一万二千人。'},{});assert(!g._populationValidatorLog);
});
test('quantity matching does not jump across commas or reuse a historical event',async()=>{
 const v=await validators();for(const text of ['百姓逃亡，守军增兵二万人。','去年百姓逃亡十二万人。','本月没有逃亡十二万人。']){const g=baseGM();v._validatePopulationConsistency(g,{shizhengji:text},{});assert(!g._populationValidatorLog,text);}
});
test('model factions alias resolves an existing stable ID without creating a shadow collection',()=>{
 const c=writer();c.GM=baseGM({facs:[{id:'A',name:'甲',cohesion:{political:35,military:48}}]});
 const r=c.applyAITurnChanges({_strictValidation:true,anyPathChanges:[{path:'GM.factions.A.cohesion.political',op:'delta',value:4},{path:'GM.factions.A.cohesion.military',op:'delta',value:2}]});
 assert(r.ok,JSON.stringify(r.applied.failed));assert.equal(c.GM.facs[0].cohesion.political,39);assert.equal(c.GM.factions,undefined);
 const before=JSON.stringify(c.GM);assert(!c.applyAITurnChanges({_strictValidation:true,anyPathChanges:[{path:'GM.factions.missing.cohesion.political',op:'delta',value:4}]}).ok);assert.equal(JSON.stringify(c.GM),before);
 assert(!c.TM.AIChange.PathUtils.applyPathSet(c.GM,'GM.factions.A.leader','幽灵').ok);
});
run(tests);
