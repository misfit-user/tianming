'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),acorn=require('acorn');
const root=path.resolve(__dirname,'../..'),web=path.join(root,'web');
const files=['tm-hongyan-edict-ui.js','tm-endturn-prep.js','tm-endturn-prompt.js','tm-endturn-ai.js','tm-endturn-apply.js','tm-endturn-validity.js','tm-ai-output-validator.js','tm-endturn-ai-helpers.js','tm-endturn-shiji-compose.js','tm-post-turn-jobs.js','tm-endturn-render.js','tm-endturn-pipeline-steps.js','tm-edict-efficacy.js','tm-imperial-orders.js','tm-tax-policy.js'];
const source=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(web,f),'utf8')]));
const trees={};
function find(file,predicate){const ast=trees[file]||(trees[file]=acorn.parse(source[file],{ecmaVersion:'latest',sourceType:'script'}));let found;function walk(n){if(!n||typeof n!=='object'||found)return;if(n.type&&predicate(n)){found=n;return;}for(const k of Object.keys(n)){const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(ast);assert(found,'AST node missing: '+file);return source[file].slice(found.start,found.end);}
function fn(file,name){return find(file,n=>n.type==='FunctionDeclaration'&&n.id&&n.id.name===name);}
const collect=fn('tm-endturn-prep.js','_endTurn_collectInput');
const cut=collect.indexOf('var allEdictText =');assert(cut>0);
// Keep the production publishing and registration path intact; stop before unrelated mechanical effects.
const collectRegistration=collect.slice(0,cut)+'return input;\n}';
const feedbackStart=source['tm-endturn-apply.js'].indexOf('if (p1.edict_feedback && Array.isArray(p1.edict_feedback) && GM._edictTracker)');
const feedbackBlock=find('tm-endturn-apply.js',n=>n.type==='IfStatement'&&n.start===feedbackStart);
const rawPrompt=find('tm-endturn-prompt.js',n=>n.type==='IfStatement'&&source['tm-endturn-prompt.js'].slice(n.test.start,n.test.end)==='_hasEdicts');
const command='着有司逐县核查水患，按月具报堤防修护进度，不得扰民。';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function context(){const input={};let seq=0;for(const id of ['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth','xinglu','xinglu-pub'])input[id]={value:''};input['edict-polished-text']={value:command};
 const c={console:{log(){},warn(){},error(){}},Date,Math,JSON,Promise,setTimeout(){return 0;},clearTimeout(){},fetch(){throw Error('Real network forbidden');},P:{ai:{key:'offline-fixture'},conf:{},playerInfo:{factionName:'朝廷'}},GM:{turn:4,sid:'edict-audit',edicts:[],chars:[],facs:[],parties:[],classes:[],vars:{},memorials:[],letters:[],_edictTracker:[],_turnReport:[],_eventBus:[],shijiHistory:[],qijuHistory:[],jishiRecords:[],turnChanges:{variables:[],characters:[],factions:[],parties:[],classes:[],military:[]}},TM:{},_$:id=>input[id]||null,_edictEl:id=>input[id]||null,_hidePolishedEdict(){},toast(){},uid:()=>('audit-'+(++seq)),recordPlayerDecision(){},resetTurnChanges(){},generateChancellorSuggestions:()=>[],_getDaysPerTurn:()=>30,getTSText:t=>'T'+t,escHtml:esc,CORE_METRIC_LABELS:{},AccountingSystem:{getLedger:()=>({items:[],totalIncome:0,totalExpense:0,netChange:0})}};
 c.addEB=(type,text)=>c.GM._eventBus.push({type,text});c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-edict-efficacy.js','tm-tax-policy.js','tm-imperial-orders.js','tm-endturn-validity.js','tm-ai-output-validator.js','tm-endturn-shiji-compose.js'])vm.runInContext(source[f],c,{filename:f});
 vm.runInContext(fn('tm-hongyan-edict-ui.js','_applyPolishedEdict')+'\n'+collectRegistration+'\n'+fn('tm-endturn-ai-helpers.js','aiEdictEfficacyAudit'),c);
 return {c,input};}
function render(c){return c._composeShijiHtml({shizhengji:'本月朝局如常，各司循例具报。',shiluText:'记本月朝事。',oldVars:{},personnelChanges:[]});}
function apply(c,rows){c.p1={edict_feedback:rows};vm.runInContext(feedbackBlock,c,{filename:'tm-endturn-apply.js:actual-edict-feedback-block'});}
const result={scope:'Offline production function/AST blocks; controlled outputs; no actual model, UI, save or production edits. Registration stops before unrelated mechanical actions.',inputSha256:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(source[f]).digest('hex')])),cases:[]};
(async()=>{
 const a=context();a.input['edict-pol'].value=command;const manual=a.c._endTurn_collectInput();assert.equal(a.c.GM._edictTracker.length,1);const manualId=a.c.GM._edictTracker[0].id;
 apply(a.c,[{edictId:manualId,content:command,status:'completed',assignee:'有司',feedback:'已按县立册，首批巡查回报已送达。',progressPercent:100}]);assert.equal(a.c.GM._edictTracker[0].status,'completed');
 const b=context();b.input['edict-pol'].value=command;b.c._applyPolishedEdict('replace');const published=b.c._endTurn_collectInput();assert.equal(published.edicts.decree,command);assert.equal(b.c.GM._edictTracker.length,0);
 b.c.edicts=published.edicts;b.c.tp='';b.c._hasEdicts=true;vm.runInContext(rawPrompt,b.c);assert(b.c.tp.includes(command));assert(!b.c.tp.includes('edictId：'));
 apply(b.c,[{edictId:b.c.GM.edicts[0].id,content:command,status:'completed',assignee:'有司',feedback:'已按县立册，首批巡查回报已送达。',progressPercent:100}]);assert.equal(b.c.GM._edictTracker.length,0);assert.equal(b.c.GM._eventBus.length,0);
 result.cases.push({name:'published whole decree has prompt text but no tracker; its actual feedback handler silently drops the report',manual:{input:manual.edicts,trackers:a.c.GM._edictTracker,events:a.c.GM._eventBus},published:{input:published.edicts,record:b.c.GM.edicts[0],trackers:b.c.GM._edictTracker,promptContainsText:b.c.tp.includes(command),promptContainsTrackerId:b.c.tp.includes('edictId：'),events:b.c.GM._eventBus}});

 const c=context();c.input['edict-pol'].value=command;c.c._endTurn_collectInput();apply(c.c,[{edictId:'unrecognized-id',status:'completed',feedback:'另一道命令的回报被错误接收。',progressPercent:100}]);assert.equal(c.c.GM._edictTracker[0].status,'completed');
 result.cases.push({name:'unknown feedback id falls back to unrelated first pending tracker',tracker:c.c.GM._edictTracker[0]});

 for(const mode of ['missing','empty','one-of-two']){const d=context();d.c.GM._edictTracker=[{id:'first',content:command,turn:4,status:'pending'},{id:'second',content:'复核地方钱粮簿册。',turn:4,status:'pending'}];const sc1={turn_summary:'各司循例具报。',shizhengji:'本月朝局如常，各司循例具报。',char_updates:[]};if(mode==='empty')sc1.edict_feedback=[];if(mode==='one-of-two')sc1.edict_feedback=[{edictId:'first',status:'executing',feedback:'已交办。'}];
  const shape=d.c.TM.validateAIOutput(sc1,'edict-audit','strict'),commit=d.c.TM.Endturn.Validity.validateBeforeCommit({input:{edicts:{political:command,economic:'复核地方钱粮簿册。'}},results:{sc1,aiResult:{shizhengji:sc1.shizhengji,zhengwen:'史臣据实记述。'}},record:{}});assert(shape.ok);assert.equal(commit.status,'ok');result.cases.push({name:'coverage-'+mode,shape,commit});}

 const e=context();e.input['edict-pol'].value=command;e.c._endTurn_collectInput();const marker='本诏已派员逐县查勘，预计下月复奏。';apply(e.c,[{edictId:e.c.GM._edictTracker[0].id,status:'executing',feedback:marker,progressPercent:30}]);assert.equal(e.c.GM._edictTracker[0].feedback,marker);e.c.GM.turn=5;const executionHtml=render(e.c);assert(!executionHtml.includes(marker));assert.equal(e.c.GM._eventBus.length,0);
 result.cases.push({name:'executing feedback is stored on the tracker but absent from turn-result HTML and current event feed',tracker:e.c.GM._edictTracker[0],renderedFeedback:executionHtml.includes(marker),events:e.c.GM._eventBus});

 const f=context();f.c.GM.turn=5;const prior='上期减赋回听标记',current='本期查勘回听标记';f.c.GM._edictEfficacyReport={turn:3,total:1,reports:[{content:prior,status:'executed',executionLevel:100}],overallEfficacy:100};
 let release;f.c.callAISmart=()=>new Promise(resolve=>{release=resolve;});const pending=f.c.aiEdictEfficacyAudit({shizhengji:'有司已经开始查勘。'},{political:command});assert.equal(typeof release,'function');const frozenHtml=render(f.c);f.c.GM.shijiHistory.push({turn:4,html:frozenHtml});assert(frozenHtml.includes(prior));
 release(JSON.stringify({reports:[{content:current,status:'executed',executionLevel:100,outcomeShortTerm:'已回报查勘结果。'}],overallEfficacy:100}));await pending;
 assert.equal(f.c.GM._edictEfficacyReport.turn,4);assert(render(f.c).includes(current));assert(!f.c.GM.shijiHistory[0].html.includes(current));assert(f.c.GM.shijiHistory[0].html.includes(prior));
 result.cases.push({name:'background audit updates live report but leaves archived turn HTML with prior-turn feedback',targetTurn:4,previousReportTurn:3,liveReportTurn:f.c.GM._edictEfficacyReport.turn,liveReportContent:f.c.GM._edictEfficacyReport.reports[0].content,archivedHasCurrent:f.c.GM.shijiHistory[0].html.includes(current),archivedHasPrior:f.c.GM.shijiHistory[0].html.includes(prior)});
 const g=context();g.c.GM.turn=5;let finish;g.c.callAISmart=()=>new Promise(resolve=>finish=resolve);const fresh=g.c.aiEdictEfficacyAudit({shizhengji:'已开始查勘。'},{political:command});g.c.GM.shijiHistory.push({turn:4,html:render(g.c)});finish(JSON.stringify({reports:[{content:current,status:'partial',executionLevel:40}],overallEfficacy:40}));await fresh;assert(!g.c.GM.shijiHistory[0].html.includes(current));
 result.cases.push({name:'first background audit also leaves an empty current-turn feedback panel',liveReports:g.c.GM._edictEfficacyReport.reports.length,archivedHasCurrent:g.c.GM.shijiHistory[0].html.includes(current)});
 for(const file of files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(web,file))).digest('hex'),result.inputSha256[file],'source drift '+file);
 fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({reproduced:result.cases.length,cases:result.cases.map(x=>x.name),sourceUnchanged:true},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
