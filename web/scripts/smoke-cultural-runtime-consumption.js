#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),acorn=require('acorn');
const WEB=path.resolve(__dirname,'..'),cache=new Map();
function source(file){if(!cache.has(file))cache.set(file,fs.readFileSync(path.join(WEB,file),'utf8'));return cache.get(file);}
function nodes(file){const out=[];function walk(n){if(!n||typeof n!=='object')return;if(n.type)out.push(n);for(const k in n){const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(acorn.parse(source(file),{ecmaVersion:'latest'}));return out;}
function extract(file,predicate){const n=nodes(file).find(predicate);assert.ok(n,'missing production node in '+file);return source(file).slice(n.start,n.end);}
function fn(file,name){return extract(file,n=>n.type==='FunctionDeclaration'&&n.id.name===name);}
const START='tm-patches-start.js',SAVE='tm-save-lifecycle.js',RAIL='phase8-formal-rightrail.js';
const template=JSON.parse(fs.readFileSync(path.join(WEB,'../scenarios/晚唐·开成五年（官方）.json'),'utf8'));
const sc={id:template.id,culturalWorks:template.culturalWorks},sid=sc.id;
const clone=x=>JSON.parse(JSON.stringify(x));
const escape=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let count=0;function ok(value,message){assert.ok(value,message);count++;}
const ctx={console,sc:clone(sc),sid,deepClone:clone,_tmHasOwn:(o,k)=>Object.prototype.hasOwnProperty.call(o,k),
  P:{scenarios:[clone(sc)],time:{year:840},playerInfo:{characterName:'李瀍'}},GM:{saveName:''},_prevSaveName:'',
  _WENYUAN_CATS:{},_WENYUAN_GENRES:{},escHtml:escape,esc:escape,attr:escape,toast(){},getPeople:()=>[],state:{},
  messages:[],actionSignals:[],modals:[],_recordPlayerActionSignal:(kind,text,meta)=>ctx.actionSignals.push({kind,text,meta}),
  _safeClone:clone,findScenarioById:id=>ctx.P.scenarios.find(s=>s.id===id),compactText:(s,n)=>String(s).slice(0,n),
  rightWorkGenreLabel:v=>v||'散文',rightWorkRiskLabel:()=>'',rightArmyRows:()=>'',rightWenFilterDefs:()=>[],rightWenFilterPass:()=>true,
  recordRightActionSignal(){},
  addEB(){},showLoading(){},hideLoading(){},updateKejuLock(){},_tmSaveSnapshotSkipKeys:()=>({})};
ctx.window=ctx;ctx.globalThis=ctx;
ctx.document={createElement(){return{set innerHTML(value){this.firstChild={outerHTML:value,remove(){}};}};},
  getElementById(){return null;},body:{appendChild(el){ctx.modals.push(el.outerHTML);}}};
ctx.openGenericModal=(title,html)=>ctx.modals.push(html);
vm.createContext(ctx);
for(const name of ['_tmStartClone','_tmSeedCulturalWorks','_tmSavedCulturalSource','_tmFindPresetCulturalWork','_tmCulturalRestoreOptions','_tmRestoredCulturalWorks'])vm.runInContext(fn(START,name),ctx);
for(const name of ['rightWorks','rightOpenWorkDetail','rightHandleWorkAction','rightAddEdictSuggestion','renderWenRich','handleRightPanelAction'])vm.runInContext(fn(RAIL,name),ctx);
for(const name of ['_showWorkDetail','_workAction'])vm.runInContext(fn('tm-player-core.js',name),ctx);
vm.runInContext(fn(SAVE,'_restoreSavedFields'),ctx);
const constructor=extract(START,n=>n.type==='AssignmentExpression'&&n.left.type==='Identifier'&&n.left.name==='GM'&&n.right.type==='ObjectExpression');
const playerSnapshot=extract(START,n=>n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.object.name==='GM'&&n.left.property.name==='playerInfo');
const capturedRestore=extract(SAVE,n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='_culturalRestore'));
const mirror=extract(SAVE,n=>n.type==='IfStatement'&&source(SAVE).slice(n.start,n.end).includes('GM._savedCulturalWorks = _safeClone(GM.culturalWorks)'));
function start(scenario=sc){ctx.sc=clone(scenario);ctx.sid=scenario.id;vm.runInContext(constructor+';'+playerSnapshot+';',ctx);}
function load(raw,config={scenarios:[clone(sc)]}){
  ctx._incomingGM=clone(raw);ctx._incomingP=clone(config);
  vm.runInContext(capturedRestore,ctx); // same capture used before the real loader's default migration
  ctx.GM=ctx._incomingGM;ctx.P=ctx._incomingP;
  if(!Object.prototype.hasOwnProperty.call(ctx.GM,'culturalWorks'))ctx.GM.culturalWorks=[];
  ctx._restoreSavedFields({culturalWorks:ctx._culturalRestore});
}
start();
ok(ctx.GM.culturalWorks.length===6,'actual new-game GM constructor binds the six scenario manuscripts');
ok(!Object.prototype.hasOwnProperty.call(ctx.P,'culturalWorks'),'test source is saved P.scenarios, not a fabricated P.culturalWorks field');
ok(ctx.GM.culturalWorks.every((w,i)=>w.content===sc.culturalWorks[i].content),'all six continuous original texts reach the runtime byte-for-byte');
ok(ctx.GM.culturalWorks.every(w=>w._scenarioPreset&&w.isForbidden===false&&Array.isArray(w.appreciatedBy)),'runtime manuscripts have action state without changing template text');
ctx.GM.culturalWorks[0].quality=77;
ok(ctx.P.scenarios[0].culturalWorks[0].quality===0,'runtime state does not alias the saved scenario template');
const before=JSON.stringify(ctx.GM);
const works=ctx.rightWorks();const markup=ctx.renderWenRich();
ok(works.length===6&&(markup.match(/tmrp-work-card/g)||[]).length===6,'formal rail shows one copy of each work');
ok(JSON.stringify(ctx.GM)===before,'rendering does not hydrate or mutate the world');
for(let i=0;i<6;i++){
  ctx.handleRightPanelAction('work-detail',{index:String(i)});
  ok(ctx.modals.at(-1).includes(escape(sc.culturalWorks[i].content)),'formal detail reaches complete text for '+sc.culturalWorks[i].title);
}
ctx.handleRightPanelAction('work-action',{index:'0',workAction:'circulate'});
ok(ctx.GM._edictSuggestions.length===1&&ctx.GM._edictSuggestions[0].content.includes(sc.culturalWorks[0].title),'formal circulation writes the selected work into the real edict queue');
ok(ctx.GM._edictSuggestions[0].from==='御前'&&ctx.actionSignals[0].meta.actor==='李瀍','deceased author is not made the live requester or actor');
ok(ctx.GM.culturalWorks[0].content===sc.culturalWorks[0].content,'circulation proposal preserves original text');
ok(ctx.GM._edictSuggestions[0].custodian===sc.culturalWorks[0].custodian,'formal action preserves the work custodian');
const activeWorld=ctx.GM;
ctx.GM={sid,running:true,turn:1};
ctx.handleRightPanelAction('work-detail',{index:'0'});
ok(ctx.modals.at(-1).includes(escape(sc.culturalWorks[0].content)),'unhydrated compatibility fallback resolves the selected P.scenarios text');
ctx.handleRightPanelAction('work-action',{index:'0',workAction:'circulate'});
ok(ctx.GM._edictSuggestions[0].content.includes(sc.culturalWorks[0].title),'compatibility fallback circulation has a real edict write path');
ctx.GM=activeWorld;

const saved=clone(ctx.GM);saved.culturalWorks[1].isForbidden=true;saved.culturalWorks[1].content='玩家校订后的抄本';
saved.culturalWorks.splice(2,1);saved._savedCulturalWorks=clone(sc.culturalWorks); // deliberately stale legacy mirror
load(saved);
ok(ctx.GM.culturalWorks.length===5,'load does not restore a deliberately removed manuscript');
ok(ctx.GM.culturalWorks[1].isForbidden&&ctx.GM.culturalWorks[1].content==='玩家校订后的抄本','canonical saved collection wins over stale mirror, preserving ban and edits');
load({sid,running:true,turn:3,culturalWorks:[],_savedCulturalWorks:clone(sc.culturalWorks)});
ok(ctx.GM.culturalWorks.length===0&&ctx.rightWorks().length===0,'explicit empty old save stays empty and does not fall back to presets');
ctx.skipMirrors={};ctx.GM._savedCulturalWorks=clone(sc.culturalWorks);vm.runInContext(mirror,ctx);
ok(Array.isArray(ctx.GM._savedCulturalWorks)&&ctx.GM._savedCulturalWorks.length===0,'saving an empty collection clears a stale mirror');
load({sid,turn:3,running:true,_savedCulturalWorks:[]});
ok(ctx.GM.culturalWorks.length===0,'an explicitly empty legacy mirror is respected');
load({sid,turn:3,running:true,_savedCulturalWorks:[{id:'old',title:'旧档文卷',content:'旧文'}]});
ok(ctx.GM.culturalWorks.length===1&&ctx.GM.culturalWorks[0].content==='旧文','legacy mirror-only save restores its own collection');
load({sid,turn:3,running:true});
ok(ctx.GM.culturalWorks.length===6,'genuinely absent legacy collection seeds from the matching saved scenario');
load({sid,turn:30,running:true,_forgottenWorks:[{id:sc.culturalWorks[0].id}]});
ok(ctx.GM.culturalWorks.length===0,'an archival trace prevents deleted or forgotten works from being reseeded');
load({sid,turn:3,running:true,works:[{id:'legacy',title:'旧文',content:'原有'}]});
ok(ctx.GM.culturalWorks[0].id==='legacy'&&ctx.rightWorks().length===1,'legacy work collection remains the runtime source');
start({id:'other',culturalWorks:[{id:'only-other',title:'异卷',author:'某人',content:'另一局'}]});
ok(ctx.GM.culturalWorks.length===1&&ctx.GM.culturalWorks[0].id==='only-other','new scenario constructor clears the prior campaign works');
start();

vm.runInContext(source('tm-ai-change-pathutils.js'),ctx);
const api=ctx.TM.AIChange.PathUtils;const firstText=ctx.GM.culturalWorks[0].content;
for(const p of ['culturalWorks.0.content','GM.culturalWorks[0].content','culturalWorks.'+sc.culturalWorks[0].id+'.content']){
  const result=api.applyPathSet(ctx.GM,p,'AI重写');
  ok(!result.ok&&ctx.GM.culturalWorks[0].content===firstText,'AI scalar text overwrite is blocked: '+p);
}
ok(!api.applyPathMerge(ctx.GM,'culturalWorks.0',{content:'替文'}).ok,'AI object merge cannot replace preset original');
ok(api.applyPathSet(ctx.GM,'culturalWorks.0.isForbidden',true).ok&&ctx.GM.culturalWorks[0].isForbidden,'AI may still apply a ban as runtime state');
ctx.GM.culturalWorks.push({id:'new',author:'今人',title:'新作',content:'待续',quality:20,isForbidden:false});
ok(api.applyPathSet(ctx.GM,'culturalWorks.6.content','今人续作').ok,'generated works remain editable by their existing completion path');
const duplicate=extract('tm-endturn-apply.js',n=>n.type==='ExpressionStatement'&&/^p1\.cultural_works\.forEach/.test(source('tm-endturn-apply.js').slice(n.start,n.end)));
ctx.p1={cultural_works:[clone(sc.culturalWorks[0])]};vm.runInContext(duplicate,ctx);
ok(ctx.GM.culturalWorks.length===7,'ordinary turn writer does not regenerate a preset as a new authored work');
const aging=extract('tm-endturn-systems.js',n=>n.type==='IfStatement'&&/^if \(GM\.culturalWorks && GM\.culturalWorks\.length > 0\)/.test(source('tm-endturn-systems.js').slice(n.start,n.end)));
ctx.GM.turn=99;vm.runInContext(aging,ctx);
ok(ctx.GM.culturalWorks.length===6&&ctx.GM._forgottenWorks.some(w=>w.id==='new'),'turn aging preserves authored originals while retaining normal generated-work aging');
ok(ctx.GM.culturalWorks[0].content===firstText,'original survives detail, proposal, AI writes and later turn cleanup');
console.log('PASS smoke-cultural-runtime-consumption: '+count+' assertions');
