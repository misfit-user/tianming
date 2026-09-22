'use strict';
const assert=require('assert/strict');
const {writer,baseGM,load,read,mainContext,vm,run}=require('./lib-player-error-regression');
const tests=[];const test=(name,fn)=>tests.push({name,fn});
test('actual SC1 application failure remains visible while completed main generation can commit',async()=>{
 const c=mainContext();c.p1={shizhengji:'甲已升任，但实际尚未落账。',zhengwen:'完整正文',char_updates:[]};
 c.afterSc1=async()=>{const e=Error('fixture write failure');e.code='ai-writeback-preflight-failed';e.writebackFailures=[{field:'char_updates'}];throw e;};
 const src=read('tm-endturn-ai.js'),a=src.indexOf('      if (typeof afterSc1 === "function") {'),b=src.indexOf('      }); // end Sub-call 1 _runSubcall',a);
 assert(a>=0&&b>a);await assert.rejects(vm.runInContext('(async()=>{'+src.slice(a,b)+'})()',c),e=>e.code==='ai-writeback-preflight-failed');
 load(c,'tm-endturn-validity.js');const out=c.TM.Endturn.Validity.validateBeforeCommit({results:{sc1:c.p1,aiResult:{shizhengji:'已升任',zhengwen:'完整'}}});assert.equal(out.ok,true);assert(out.warnings.some(w=>w.includes('尚未落账')));
});
test('SC1 wrapper never swallows a preflight or non-transport application failure',async()=>{
 const c=mainContext();for(const code of ['ai-writeback-preflight-failed','ai-writeback-atomic-failed','OTHER_APPLY'])await assert.rejects(c._runSubcall('sc1','主推演','lite',async()=>{const e=Error('failure');e.code=code;throw e;}),e=>e.code===code);
});
test('missing writeback receipt is deferred but missing or fabricated main generation still fails',()=>{
 const c=mainContext();load(c,'tm-endturn-validity.js');const validate=c.TM.Endturn.Validity.validateBeforeCommit;
 const ctx={results:{sc1:{turn_summary:'正常'},aiResult:{shizhengji:'完整时政',zhengwen:'完整正文'}},meta:{requireMainWriteback:true}};
 const pending=validate(ctx);assert(pending.ok);assert(pending.warnings.some(w=>w.includes('回执不完整')));ctx.meta.mainWriteback={ok:true,turn:c.GM.turn};assert(validate(ctx).ok);
 ctx.results.sc1._emergencyFallback=true;assert(!validate(ctx).ok);delete ctx.results.sc1._emergencyFallback;
 ctx.results.aiResult.shizhengji={content:'不是字符串'};assert(!validate(ctx).ok);
});
const noEvents=['朝廷本月未遣使，外交关系保持不变。','本月没有颁诏，仍照旧章行事。','诸臣商议延聘名儒讲学。','上年已经即位，本月仅翻阅旧档。','朝廷计划明年缔盟。','双方尚未成婚。'];
test('issued player orders use the real tracker while old or unissued drafts cannot certify new laws',()=>{
 for(const status of ['pending_delivery','draft','cancelled']){
 const c=writer();c.GM=baseGM({custom:{score:10},_edictTracker:[{id:'order-a',turn:9,status,content:'本回合下达的赈济诏令'}]});
 const r=c.applyAITurnChanges({_strictValidation:true,shizhengji:'上首发明诏，大饬庶政。',changes:[{path:'custom.score',delta:5}]});
 assert(r.ok);assert.equal(!!c.GM._edictEffectValidatorLog,status!=='pending_delivery');}
 const c=writer();c.GM=baseGM({_edictTracker:[{turn:8,status:'executing',content:'旧诏'}]});
 assert(c.applyAITurnChanges({_strictValidation:true,shizhengji:'本月正式颁诏施行新制。'}).ok);assert(c.GM._edictEffectValidatorLog?.length);
 assert(c.applyAITurnChanges({_strictValidation:true,shizhengji:'上降旨斥责失职官员，留任候勘。'}).ok);
});
for(const text of noEvents)test('non-event is not a new mandatory mutation: '+text,()=>{
 const c=writer();c.GM=baseGM({custom:{score:10}});const r=c.applyAITurnChanges({_strictValidation:true,shizhengji:text,changes:[{path:'custom.score',delta:5}]});assert(r.ok,JSON.stringify(r.applied.failed));assert.equal(c.GM.custom.score,15);
});
for(const text of ['甲与乙成婚。','本月正式与邻国缔盟。','本月正式颁诏施行新制。','本月未遣使；但今日正式遣使缔盟。'])test('narrative scan retains a warning without rejecting unrelated typed writes: '+text,()=>{
 for(const count of [0,19,20,40]){const c=writer();c.GM=baseGM({custom:{score:10},_marriageBirthValidatorLog:Array.from({length:count},()=>({turn:1,warnings:[{kind:'old'}]})),_diplomacyValidatorLog:Array.from({length:count},()=>({turn:1,warnings:[{kind:'old'}]})),_edictEffectValidatorLog:Array.from({length:count},()=>({turn:1,warnings:[{kind:'old'}]}))});
 const r=c.applyAITurnChanges({_strictValidation:true,shizhengji:text,changes:[{path:'custom.score',delta:5}]});assert.equal(r.ok,true);assert.equal(c.GM.custom.score,15);assert.equal(r.applied.failed.length,0);assert(Object.keys(c.GM).some(k=>/ValidatorLog$/.test(k)&&c.GM[k].some(x=>x.turn===c.GM.turn&&x.warnings?.length)));}
});
for(const key of ['changes','updates'])test('marriage recognizes actual '+key+' effects and not an unrelated field',()=>{
 const c=writer();c.GM=baseGM({chars:[{id:'a',name:'甲',alive:true,spouse:'',loyalty:40},{id:'b',name:'乙',alive:true,spouse:''}]});
 const rows=[{characterId:'a',name:'甲',[key]:{spouse:'乙'}},{characterId:'b',name:'乙',[key]:{spouse:'甲'}}];
 const r=c.applyAITurnChanges({_strictValidation:true,shizhengji:'甲与乙成婚。',char_updates:rows});assert(r.ok,JSON.stringify(r.applied.failed));assert.equal(c.GM.chars[0].spouse,'乙');
 c.GM.chars[0].spouse='';c.GM.chars[1].spouse='';const bad=c.applyAITurnChanges({_strictValidation:true,shizhengji:'甲与乙成婚。',char_updates:[{characterId:'a',updates:{loyalty:60}}]});assert(bad.ok);assert.equal(c.GM.chars[0].loyalty,60);assert.equal(c.GM.chars[0].spouse,'');assert(c.GM._marriageBirthValidatorLog?.length);
});
function repairs(c,who){return JSON.stringify({repairs:[{field:'char_updates',index:0,item:{characterId:who,name:who==='a'?'甲':'乙',updates:{loyalty:60}}}],semanticUnchanged:true,narrativePatch:''});}
function identityFixture(){const c=writer();load(c,'tm-endturn-apply-stages.js');c.GM=baseGM({chars:[{id:'a',name:'甲',alive:true,loyalty:40},{id:'b',name:'乙',alive:true,loyalty:40}]});return c;}
test('repair cannot retarget an originally named person',async()=>{
 const c=identityFixture(),before=JSON.stringify(c.GM);c.callAI=async()=>repairs(c,'b');
 await assert.rejects(c.TM.Endturn.AI.apply._validateAndRepairMainWriteback({shizhengji:'赏赐甲',char_updates:[{characterId:'broken',name:'甲',updates:{loyalty:60}}]}),e=>e.lastRepairFailureCode==='repair-identity-not-preserved');assert.equal(JSON.stringify(c.GM),before);
});
test('repair of an invalid ID to the same uniquely named entity remains available',async()=>{
 const c=identityFixture();c.callAI=async()=>repairs(c,'a');const p={char_updates:[{characterId:'broken',name:'甲',updates:{loyalty:60}}]};
 const out=await c.TM.Endturn.AI.apply._validateAndRepairMainWriteback(p);assert(out.ok);assert.equal(out.output.char_updates[0].characterId,'a');assert.equal(p.char_updates[0].characterId,'broken');assert.equal(c.GM.chars[0].loyalty,40);
});
test('an unanchored ghost is rejected without asking another model to guess',async()=>{
 const c=identityFixture();let calls=0;c.callAI=async()=>{calls++;return repairs(c,'a');};await assert.rejects(c.TM.Endturn.AI.apply._validateAndRepairMainWriteback({char_updates:[{characterId:'ghost',updates:{loyalty:60}}]}),e=>e.code==='ai-writeback-preflight-failed'&&e.repairAttempts===0);assert.equal(calls,0);
});
test('conflicting stable ID and display name cannot bypass preflight',()=>{
 const c=identityFixture(),before=JSON.stringify(c.GM);const out=c.validateAIWriteBackBatch({char_updates:[{characterId:'a',name:'乙',updates:{loyalty:60}}]});assert(!out.ok);assert(out.failures.some(f=>f.code==='conflicting-identity'));assert.equal(JSON.stringify(c.GM),before);
});
test('ambiguous original names cannot be repaired by choosing one arbitrary person',async()=>{
 const c=identityFixture();c.GM.chars.push({id:'a2',name:'甲',alive:true,loyalty:40});let calls=0;c.callAI=async()=>{calls++;return repairs(c,'a');};await assert.rejects(c.TM.Endturn.AI.apply._validateAndRepairMainWriteback({char_updates:[{name:'甲',updates:{loyalty:60}}]}));assert.equal(calls,0);
});
test('a stale repair response cannot be applied after switching worlds',async()=>{
 const c=identityFixture(),old=c.GM;c.callAI=async()=>{c.GM=baseGM({turn:99});return repairs(c,'a');};await assert.rejects(c.TM.Endturn.AI.apply._validateAndRepairMainWriteback({char_updates:[{characterId:'broken',name:'甲',updates:{loyalty:60}}]}),e=>e.code==='AI_STALE_WORLD');assert.equal(old.chars[0].loyalty,40);assert.equal(c.GM.turn,99);
});
test('schema recognition is retained with and without the canonical schema',()=>{
 for(const canonical of [false,true]){const c=writer();if(canonical)load(c,'tm-ai-schema.js');load(c,'tm-ai-output-validator.js');const r=c.TM.validateAIOutput({faction_ai_outcomes:[],resource_changes:[],player_status:'正常'},'subcall1c');assert(r.ok);assert.equal(r.stats.unknownKeys,0);}
});
test('current SC1 field shapes and legacy shapes both agree with the output validator',()=>{
 for(const canonical of [false,true]){const c=writer();if(canonical)load(c,'tm-ai-schema.js');load(c,'tm-ai-output-validator.js');
 for(const payload of [{shizhengji_basis:'原始事实依据',resource_changes:{民心:1}},{shizhengji_basis:{facts:['旧格式']},resource_changes:[]}]){
 const r=c.TM.validateAIOutput(payload,'subcall1');assert(r.ok,JSON.stringify(r.errors));assert.equal(r.warnings.length,0);}}
});
test('stable ID selects the intended duplicate-name character and supports ID-only updates',()=>{
 const c=writer();c.GM=baseGM({chars:[{id:'a',name:'同名',loyalty:40},{id:'b',name:'同名',loyalty:40}]});
 const r=c.applyAITurnChanges({_strictValidation:true,char_updates:[{characterId:'b',name:'同名',updates:{loyalty:60}}]});assert(r.ok);assert.equal(c.GM.chars[0].loyalty,40);assert.equal(c.GM.chars[1].loyalty,60);
 const s=c.applyAITurnChanges({_strictValidation:true,char_updates:[{characterId:'b',updates:{loyalty:65}}]});assert(s.ok);assert.equal(c.GM.chars[1].loyalty,65);
});
test('conflicting old and new update payloads are rejected rather than choosing an effect',()=>{
 const c=writer();c.GM=baseGM({chars:[{id:'a',name:'甲',loyalty:40}]});const before=JSON.stringify(c.GM);
 const r=c.applyAITurnChanges({_strictValidation:true,char_updates:[{name:'甲',changes:{loyalty:45},updates:{loyalty:65}}]});assert(!r.ok);assert.equal(JSON.stringify(c.GM),before);
});
for(const [text,shouldApply] of [['本月不但颁诏，还命百官遵行。',false],['上年拟定的新法本月正式颁诏施行。',false],['朝廷不得不正式与邻国缔盟。',false],['本月计划正式颁诏。',true],['本月不但没有颁诏，也未遣使。',true]])test('affirmation and time qualification: '+text,()=>{
 const c=writer();c.GM=baseGM({custom:{score:10}});const result=c.applyAITurnChanges({_strictValidation:true,shizhengji:text,changes:[{path:'custom.score',delta:5}]});assert.equal(result.ok,true);assert.equal(c.GM.custom.score,15);assert.equal(Object.keys(c.GM).some(k=>/^_(edictEffect|diplomacy)ValidatorLog$/.test(k)),!shouldApply);
});
for(const text of ['朝廷计划本月颁诏。','去年计划今年颁诏。'])test('a scheduled event remains a plan: '+text,()=>{
 const c=writer();c.GM=baseGM({custom:{score:10}});
 const result=c.applyAITurnChanges({_strictValidation:true,shizhengji:text,changes:[{path:'custom.score',delta:5}]});
 assert.equal(result.ok,true);assert.equal(c.GM.custom.score,15);
});
run(tests);
