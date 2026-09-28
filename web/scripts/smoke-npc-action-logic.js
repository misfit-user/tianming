#!/usr/bin/env node
'use strict';
// Earlier assertions locked in name-wide exclusion, private batch leakage and unsourced rewards.
// Exercise the real registry and selectors with the corrected stage/identity contract instead.
const assert=require('assert/strict'),{fixture}=require('./lib-npc-action-fixture');
let count=0;const ok=(v,m)=>{assert(v,m);count++;};
(async()=>{
 const c=fixture(),a=c.actor('a','主管',{ambition:82,intelligence:86,integrity:90,officialTitle:'主官'}),b=c.actor('b','同僚'),remote=c.actor('r','边臣',{location:'边地',officialTitle:'守臣'}),general=c.actor('g','将领',{officialTitle:'统兵',troops:100}),free=c.actor('f','书生',{personalGoal:'问学'});
 c.GM.officeTree=[{id:'d',name:'院',positions:[{id:'head',name:'主官',holderId:a.id,holder:a.name,powers:{supervise:true}},{id:'r-office',name:'守臣',holderId:remote.id,holder:remote.name}]}];
 c.GM.armies=[{id:'army',commander:general.name,training:40}];
 ok(typeof c.NpcEngine==='undefined'&&typeof c.InteractionSystem==='undefined','retired driving engines remain absent');
 for(const type of ['appoint','dismiss','transfer','reward','punish','declare_war','reform','office_duty','private_life','request_funds','private_correspondence'])ok(c.NpcBehaviorRegistry.list().includes(type),'registered '+type);
 for(const [from,to] of [['sendLetter','send_letter'],['officeDuty','office_duty'],['privateCorrespondence','private_correspondence']])ok(c._normalizeNpcBehaviorType(from)===to,'alias normalization '+from);
 const context=c.buildNpcBehaviorContext(a),cards=c._buildNpcActionCandidates(a,context);
 for(const type of ['petition','office_duty','private_correspondence'])ok(cards.some(x=>x.behaviorType===type),'real candidate '+type);
 ok(cards.every(x=>typeof x.score==='number'&&x.motive),'motives and choices remain open to the model');
 const raw={name:a.name,actorId:a.id,actionId:cards.find(x=>x.behaviorType==='petition').id,shouldExecute:true};
 ok(c._executeNormalizedNpcDecision(raw,a,context),'a candidate card resolves to an actual submission');
 ok(c.GM.memorials.length===1,'memorial domain evidence exists');ok(raw._executionResult.outcome==='submitted','request is not fulfillment');
 ok(c.execute(a,'petition',{actionId:'another-matter',intent:'另一件事'}),'a different matter is permitted');
 ok(!c.execute(a,'petition',{actionId:'another-matter',intent:'另一件事'}),'the same operation cannot repeat');
 c.TM.NPC.ActionLedger.primeTurnContextFromP1({npc_letters:[{from:a.name}],npc_actions:[{name:free.name}]},c.GM);
 ok(!c.TM.NPC.ActionLedger.isHandled(a.name,c.GM),'a generated mention is not a spent action');
 ok(c.selectImportantNpcs(c.GM.chars).includes(free),'personal goal schedules a commoner');
 ok(c.execute(general,'train_troops',{armyId:'army'}),'actual command trains troops');ok(c.GM.armies[0].training===45,'one simulation interval trains once');
 ok(!c.execute(general,'train_troops',{armyId:'army'}),'waiting in real time adds no second interval');
 const titleOnly=c.actor('fake','空衔',{officialTitle:'大将军'});ok(!c._hasMilitaryCommand(titleOnly),'title regex does not grant command');
 ok(c.execute(remote,'seek_audience'),'remote audience request redirects to mail');ok(c.GM._pendingNpcLetters.length===1,'redirect retains the submission receipt');
 ok(c.execute(a,'request_funds',{amount:100}),'funding request is submitted');ok(c.GM.guoku.money===1000,'request does not approve itself');
 ok(!c.execute(a,'reward',{target:b.name,targetId:b.id}),'missing amount and accounts cannot create a reward');
 c.GM.chars.find(x=>x.id===b.id).isPlayer=true;ok(!c.execute(b,'petition'),'autonomous player action is rejected');c.GM.chars.find(x=>x.id===b.id).isPlayer=false;
 c.GM.chars.find(x=>x.id===a.id).alive=false;ok(!c.execute(a,'petition'),'dead actor cannot act');c.GM.chars.find(x=>x.id===a.id).alive=true;
 const own=c.GM.chars.find(x=>x.id==='a');own.alive=true;
 own.innerThought='ONLY_A_KNOWS';c.GM._npcInternalActionHistory=[{actor:b.name,intent:'ONLY_B_KNOWS',visibility:'hidden',turn:c.GM.turn}];
 let prompts=[],calls=0;c.extractJSON=JSON.parse;c.callAI=async p=>{calls++;prompts.push(p);return '[]';};
 await c.batchNpcDecisions([own,b],c.buildNpcBehaviorContext());ok(!prompts[0].includes('ONLY_'),'public batch contains no private material');
 await c.npcDecisionLayer(own,context);ok(prompts[1].includes('ONLY_A_KNOWS')&&!prompts[1].includes('ONLY_B_KNOWS'),'single fallback uses the same knowledge filter');
 c.GM.turn++;calls=0;await c.executeNpcBehaviors();await c.executeNpcBehaviors({idle:true});await c.executeNpcBehaviors({idle:true});ok(calls<=3,'generation and supplement share a total per-turn budget');
 const timers=[];c.setTimeout=(fn,delay)=>{const t={fn,delay};timers.push(t);return t;};c.clearTimeout=t=>t.cleared=true;
 c.GM.turn++;ok(c._scheduleNpcIdleAutonomyLoop({delayMs:5,maxRounds:2}),'idle schedule stays available');ok(timers.length===1&&timers[0].delay===5,'configured scheduling delay retained');
 c.GM.busy=true;await timers[0].fn();ok(c.GM._npcIdleAutonomy.stopped,'busy next turn cancels idle generation');
 console.log('[smoke-npc-action-logic] PASS '+count+' assertions');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
