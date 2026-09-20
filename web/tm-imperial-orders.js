/* One task ledger for orders, evidence and report delivery. AI feedback is a claim, not a receipt. */
(function(root){'use strict';var TM=root.TM=root.TM||{},arr=x=>Array.isArray(x)?x:[];
function day(g){return TM.TaxPolicy.now(g);}function days(g){return TM.TaxPolicy.turnDays(g);}
function alive(c){return !!c&&c.alive!==false&&!c.dead;}
function actor(g,c,name){return arr(g.chars).find(x=>c.actorId?x.id===c.actorId:x.name===name)||null;}
function ledger(g){if(!g._npcCommitments||typeof g._npcCommitments!=='object'||Array.isArray(g._npcCommitments))g._npcCommitments={};return g._npcCommitments;}
function all(g){var out=[];Object.keys(g._npcCommitments||{}).forEach(name=>arr(g._npcCommitments[name]).forEach(c=>{if(c&&c.task)out.push({name:name,c:c,actor:actor(g,c,name)});}));return out;}
function deadline(g,text,value){
 var literal=String(text||'').match(/^([零一二两三四五六七八九十百\d]+)\s*(个?月|回合|年|天|日)(?:内|前)?$/);
 if(literal)return Math.max(1,Math.ceil(TM.TaxPolicy.number(literal[1])*({'月':30,'个月':30,'年':360,'回合':days(g),'天':1,'日':1}[literal[2]])/days(g)));
 if(Number.isFinite(Number(value))&&Number(value)>0)return Number(value);
 var m=String(text).match(/(?:限(?:期)?|第)?([零一二两三四五六七八九十百\d]+)\s*(个?月|回合|年|天|日)(?:之?内|前)?[^，。；]{0,12}(?:汇报|回报|复命|具奏|奏报|查清|办结|完成)/);
 if(!m)return 3;var n=TM.TaxPolicy.number(m[1]);
 return Math.max(1,Math.ceil(n*({'月':30,'个月':30,'年':360,'回合':days(g),'天':1,'日':1}[m[2]])/days(g)));
}
function category(text){if(/查|核|审|稽|调查/.test(text))return 'query';if(/税|赋|财政|钱粮/.test(text))return 'finance';if(/撰|拟|编写|写成/.test(text))return 'write';if(/侦|密探|刺探/.test(text))return 'intel';return 'other';}
function create(g,name,text,opts){
 opts=opts||{};var ch=arr(g.chars).find(c=>c&&(c.id===name||c.name===name));
 if(!alive(ch)||ch.isPlayer)return {ok:false,reason:'承办人不在册或不可领命'};
 var pf=TM.TaxPolicy.player(g),aff=ch.factionId||ch.faction;
 if(aff&&aff!==pf.id&&aff!==pf.name&&!String(aff).startsWith(pf.name+'·'))return {ok:false,reason:'不可将本朝交办直接强加给外国人物'};
 text=String(text||'').trim();if(!text||text.length>12000)return {ok:false,reason:'交办内容为空或过长'};
 var list=ledger(g)[ch.name];if(!Array.isArray(list))list=g._npcCommitments[ch.name]=[];
 var turn=Number(g.turn)||0,source=opts.sourceId||'direct:'+turn+':'+ch.id+':'+text;
 var old=list.find(c=>c&&c.sourceId===source&&c.task===text);if(old)return {ok:true,task:old,duplicate:true};
 var seq=(Number(g._imperialOrderSequence)||0)+1;g._imperialOrderSequence=seq;
 var c={id:'order-'+turn+'-'+seq,actorId:ch.id||'',task:text,sourceText:text,sourceId:source,sourceType:opts.sourceType||'direct-order',
 assignedTurn:turn,assignedDay:day(g),deadline:deadline(g,text,opts.deadline),category:opts.category||category(text),
 willingness:Number.isFinite(opts.willingness)?Math.max(0,Math.min(1,opts.willingness)):.6,status:'pending',progress:0,attempts:0,
 feedback:'',responsibility:'npc',_source:opts.sourceType||'direct-order',schemaVersion:2,verificationStatus:'pending',reportState:'not_due'};
 c.dueDay=c.assignedDay+c.deadline*days(g);c.sourceRefs=[{type:c.sourceType,id:source,turn:turn,authority:'player_pin'}];list.push(c);
 if(opts.executeTax&&!/若|倘|查明后|核验后|待.*后|是否/.test(text)){
  var tax=TM.TaxPolicy.apply(g,text,{}, {sourceId:'task:'+c.id});
  if(tax.ok)c.taxReceiptIds=tax.receiptIds;else if(tax.handled)c.executionBlock=tax.reason;
 }
 if(root.NpcMemorySystem)root.NpcMemorySystem.remember(ch.name,'奉命：'+text,'敬',7,'天子',{type:'commitment',source:'witnessed',sourceRefs:c.sourceRefs,taskId:c.id});
 g._continuityRevision=(Number(g._continuityRevision)||0)+1;return {ok:true,task:c};
}
function verified(g,c){
 if(!c||c.status==='cancelled')return {ok:false,refs:[],reason:'原交办已撤回'};
 if(c.playerAcceptance&&c.playerAcceptance.taskId===c.id)return {ok:true,refs:[c.playerAcceptance]};
 var receipts=arr(g.fiscalConfig&&g.fiscalConfig.taxPolicies).filter(p=>
  arr(c.taxReceiptIds).includes(p.id)&&p.sourceId==='task:'+c.id||p.sourceId===c.sourceId&&p.sourceId.indexOf('edict:')===0);
 if(receipts.length&&TM.TaxPolicy.coversTask&&TM.TaxPolicy.coversTask(g,c.task))return {ok:true,refs:receipts.map(p=>({type:'tax_policy',id:p.id,taskId:c.id}))};
 var works=arr(g.culturalWorks).filter(w=>w&&w._taskId===c.id&&(w.content||w.text));
 if(c.category==='write'&&works.length)return {ok:true,refs:works.map(w=>({type:'written_work',id:w.id,taskId:c.id}))};
 return {ok:false,refs:[],reason:'尚无与本项交办绑定的执行凭据'};
}
function label(c){return c.status==='cancelled'?'原命已撤回':c.verificationStatus==='legacy_unverified'?'旧记录称完成·未核验':c.verificationStatus==='pending_review'?'承办自报完成·待核验':c.status==='completed'?'已核验完成':c.status==='failed'?'未完成·已逾期':c.status==='delayed'?'逾期或受阻':'承办中';}
function memorialRecord(r){return {id:r.id,from:r.from,title:'交办复命：'+r.content.split('\n')[0].slice(0,35),subject:'交办复命',summary:r.content,content:r.content,type:'report',category:'政务',turn:r.turn,status:'pending',read:false,_taskId:r.taskId,_taskReportId:r.id,_taskLedgerGenerated:true};}
function deliver(g,r){
 if(['read','intercepted','dismissed'].includes(r.state))return;
 if(r.channel==='letter'){
  if(arr(g.letters).some(l=>l._taskReportId===r.id)||arr(g._pendingNpcLetters).some(q=>q.taskReportId===r.id))return;
  if(!Array.isArray(g._pendingNpcLetters))g._pendingNpcLetters=[];
  g._pendingNpcLetters.push({from:r.from,content:r.content,type:'report',replyExpected:false,taskId:r.taskId,taskReportId:r.id});r.state='queued';
 }else if(r.channel==='audience'){
  if(arr(g._pendingAudiences).some(q=>q.taskReportId===r.id))return;
  if(r.state==='delivered'){r.state='dismissed';return;}
  if(!Array.isArray(g._pendingAudiences))g._pendingAudiences=[];
  g._pendingAudiences.push({_qid:r.id,name:r.from,reason:r.content,turn:r.turn,taskId:r.taskId,taskReportId:r.id});r.state='delivered';
 }else{
  if(!Array.isArray(g.memorials))g.memorials=[];
  if(!g.memorials.some(m=>m._taskReportId===r.id))g.memorials.push(memorialRecord(r));r.state='delivered';
 }
}
function mergeMemorials(g,next){
 var protectedRows=arr(g.memorials).filter(m=>m&&m._taskLedgerGenerated&&m._taskReportId&&
  (!m.read&&!m._playerRead&&!['approved','rejected','annotated','referred'].includes(m.status)||m.turn===g.turn));
 var seen=new Set(),out=[];
 protectedRows.concat(arr(next)).forEach(m=>{if(!m)return;var id=m._taskReportId||m.id;if(id&&seen.has(id))return;if(id)seen.add(id);out.push(m);});return out;
}
function report(g,name,c,reason){
 if(!Array.isArray(g._imperialReports))g._imperialReports=[];
 var signature=reason+':'+String(c.lastUpdateTurn||'')+':'+c.status+':'+String(c.feedback||'');
 if(g._imperialReports.some(r=>r.taskId===c.id&&r.signature===signature))return;
 var ch=actor(g,c,name),live=alive(ch),from=live?ch.name:'有司';
 var id='task-report:'+c.id+':'+(g._imperialReports.filter(r=>r.taskId===c.id).length+1);
 var text='交办复命｜'+c.task+'\n状态：'+label(c)+'。\n'+
 (c.verificationStatus==='verified'?'已核对执行凭据：'+arr(c.evidenceRefs).map(r=>r.id).join('、')+'。':'尚未取得可验证的完成凭据，不据此认定实际功成。')+
 (c.feedback?'\n承办反馈（自述）：'+c.feedback:'\n截至本次核验，没有新的承办反馈。')+
 (!live?'\n原承办人已故、失联或不在名册，须另行指定责任人。':'');
 var channel=live&&(/传书|鸿雁|来函/.test(c.task)||(ch.location&&ch.location!==(g._capital||'京城')))?'letter':/面奏|请见|问对/.test(c.task)&&live?'audience':'memorial';
 var rec={id:id,taskId:c.id,actorId:c.actorId,from:from,reason:reason,signature:signature,turn:Number(g.turn)||0,channel:channel,state:'queued',content:text};
 g._imperialReports.push(rec);deliver(g,rec);c.reportState=rec.state;c.lastReportId=id;
 if(root.addEB)root.addEB('交办复命',from+'：'+label(c)+'（'+(channel==='letter'?'已交驿递':channel==='audience'?'已请见':'已呈奏疏')+'）');
}
function update(g,name,c,u){
 if(!c||!u||c.status==='cancelled'||c._terminalSettled&&c.verificationStatus==='verified')return;
 var ch=actor(g,c,name);if(!alive(ch)){c.executionBlock='原承办人不可继续执行';report(g,name,c,'actor-unavailable');return;}
 if(c.actorId&&u.npcName&&u.npcName!==ch.name)return;
 var fingerprint=JSON.stringify(u),turn=Number(g.turn)||0;
 if(c._updateTurn!==turn){c._updateTurn=turn;c._updateKeys=[];}
 if(arr(c._updateKeys).includes(fingerprint))return;c._updateKeys.push(fingerprint);
 var progress=u.progressPercent!=null?Number(u.progressPercent):u.progress!=null?Number(u.progress):
 u.progress_delta!=null?(Number(c.progress)||0)+Number(u.progress_delta):Number(c.progress)||0;
 if(Number.isFinite(progress))c.progress=Math.max(0,Math.min(100,progress));
 c.lastUpdateTurn=turn;if(typeof u.feedback==='string')c.feedback=u.feedback.slice(0,8000);
 c.schemaVersion=2;if(!c.actorId)c.actorId=ch.id||'';
 var wantsComplete=u.status==='completed'||u.consequenceType==='success',proof=verified(g,c);
 if(wantsComplete&&proof.ok){
  c.status='completed';c.progress=100;c.verificationStatus='verified';c.evidenceRefs=proof.refs;
  c._terminalSettled=true;c._terminalSettledTurn=turn;c._terminalSettledKind='verified_completed';
 }else if(wantsComplete){
  c.status='executing';c.verificationStatus='pending_review';c._terminalSettled=false;
  c.executionBlock=proof.reason;c.reportedComplete=true;
 }else if(u.status==='failed'||u.status==='obstructed'||u.consequenceType==='abandoned'){
  c.status='failed';c.verificationStatus='reported_failure';c._terminalSettled=true;
  c._terminalSettledTurn=turn;c._failReason=String(u.failReason||'承办人报告未能完成');
 }else if(['pending','executing','delayed'].includes(u.status))c.status=u.status;
 if(root.NpcMemorySystem&&(c.feedback||wantsComplete)){
  var accepted=c.verificationStatus==='verified';
  root.NpcMemorySystem.remember(ch.name,(accepted?'有凭据确认：':'承办自述（尚待核验）：')+c.task+'——'+(c.feedback||label(c)),
   '平',7,'天子',{type:'task_report',source:accepted?'witnessed':'reported',credibility:accepted?95:55,
    taskId:c.id,factStatus:accepted?'verified':'unverified_claim',sourceRefs:accepted?c.evidenceRefs:c.sourceRefs});
 }
 if(wantsComplete||c.status==='failed'||c.feedback)report(g,ch.name,c,wantsComplete?'completion':'progress');
 g._continuityRevision=(Number(g._continuityRevision)||0)+1;
}
function updates(g,list){arr(list).forEach(u=>{if(!u||!u.id)return;var matches=all(g).filter(x=>x.c.id===u.id);if(matches.length===1)update(g,matches[0].name,matches[0].c,u);});}
function fromDialogue(g,sources,feedback){
 arr(sources).forEach(s=>{if(!s||!s.npc||!s.task)return;
  var prior=all(g).filter(x=>(x.actor?x.actor.name:x.name)===s.npc&&x.c.task===s.task&&['direct-order','edict'].includes(x.c.sourceType||x.c._source)&&!x.c._terminalSettled);
  var created=prior.length===1?{ok:true,task:prior[0].c,duplicate:true}:create(g,s.npc,s.task,{sourceId:'dialogue:'+String(s.source_conv_id||g.turn+':'+s.npc),sourceType:s.source_type||'dialogue',category:s.category,deadline:deadline(g,s.deadline||s.task),willingness:s.willingness});
  if(created.ok){var c=created.task;c._sc1qSourceConvId=s.source_conv_id||'';c._sc1qSource=s.source_type||'';c._sc1qTarget=s.required_npc_action||'';c._sc1qPlayerEmphasis=s.player_emphasis||'';var ref={type:'dialogueCommitment',id:s.source_conv_id||c.id,authority:'court_report',turn:g.turn,role:'commitment_source'};c.sourceRefs=arr(c.sourceRefs).filter(r=>!(r.type===ref.type&&r.id===ref.id)).concat([ref]);c.basisRefs=c.sourceRefs;}
 });
 arr(feedback).forEach(u=>{if(!u||!u.npc)return;var candidates=all(g).filter(x=>x.actor&&x.actor.name===u.npc&&
  (u.source_conv_id?(x.c.sourceId==='dialogue:'+u.source_conv_id||arr(x.c.sourceRefs).some(r=>r.type==='dialogueCommitment'&&r.id===u.source_conv_id)):typeof u.task==='string'&&x.c.task===u.task));
  if(u.task&&candidates.length>1)candidates=candidates.filter(x=>x.c.task===u.task);
  if(candidates.length===1)update(g,candidates[0].name,candidates[0].c,u);
 });
}
function ingestEdicts(g){
 arr(g._edictTracker).forEach(e=>{
  if(!e||!e.id||!e.content||['pending_delivery','rejected','cancelled','revoked','completed','failed','archived'].includes(e.status))return;
  var text=String(e.content);arr(g.chars).forEach(ch=>{
   if(!alive(ch)||ch.isPlayer||!ch.name)return;
   var escaped=ch.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   if(!new RegExp('(?:命|责成|交由|着|令)[^，,。；;]{0,18}'+escaped).test(text))return;
   create(g,ch.name,text,{sourceId:'edict:'+e.id,sourceType:'edict',executeTax:false});
  });
 });
}
function refreshReports(g){
 arr(g._imperialReports).forEach(r=>{
  deliver(g,r);
  if(r.channel==='letter'){
   var l=arr(g.letters).find(l=>l._taskReportId===r.id);
   if(l)r.state=l._playerRead?'read':l.status==='returned'?'delivered':l.status==='intercepted'?'intercepted':'in_transit';
  }else if(r.channel==='memorial'){
   var m=arr(g.memorials).find(m=>m._taskReportId===r.id);
   if(m&&(m.read||m._playerRead||['approved','rejected','annotated','referred'].includes(m.status)))r.state='read';
  }
  var x=all(g).find(x=>x.c.id===r.taskId);if(x&&x.c.lastReportId===r.id)x.c.reportState=r.state;
 });
}
function tick(g){
 ingestEdicts(g);var today=day(g);all(g).forEach(x=>{
  var source=String(x.c.sourceId||'');
  var edict=source.startsWith('edict:')?arr(g._edictTracker).find(e=>e.id===source.slice(6)):null;
  if(edict&&['cancelled','revoked','rejected'].includes(edict.status)&&x.c.verificationStatus!=='verified'){
   x.c.status='cancelled';x.c._terminalSettled=true;x.c.verificationStatus='cancelled';x.c.feedback='原交办已撤回，不再继续执行';report(g,x.name,x.c,'cancelled');return;
  }
  if(x.c.status==='cancelled')return;
  var c=x.c,ch=x.actor;if(!Number.isFinite(c.assignedTurn))c.assignedTurn=Number(g.turn)||0;
  if(!Number.isFinite(c.dueDay))c.dueDay=Math.max(0,c.assignedTurn-1)*days(g)+(Number(c.deadline)||3)*days(g);
  if(ch&&ch.id&&!c.actorId)c.actorId=ch.id;
  if(c.status==='completed'){
   if(c.verificationStatus!=='verified')c.verificationStatus=c.verificationStatus||'legacy_unverified';
   if(c.schemaVersion===2&&!c.lastReportId)report(g,x.name,c,'completion');return;
  }
  if(c.status==='failed')return;
  var proof=verified(g,c);
  if(proof.ok){
   update(g,x.name,c,{status:'completed',feedback:c.feedback||'已查见与本项命令绑定的执行凭据'});return;
  }
  if(today>=c.dueDay){
   c.overdue=true;c.status='delayed';
   var last=Number.isFinite(c.lastUpdateTurn)?Math.max(0,c.lastUpdateTurn-1)*days(g):c.assignedDay||0;
   if(today>c.dueDay+2*days(g)&&today-last>2*days(g)){
    c.status='failed';c._terminalSettled=true;c._failReason='逾期未提交可核验的结果';
    c.verificationStatus='unverified_lapsed';
   }
   report(g,x.name,c,c.status==='failed'?'lapsed':'overdue');
  }
 });refreshReports(g);
}
function context(g,name){
 return all(g).filter(x=>x.actor?x.actor.name===name:x.name===name)
 .sort((a,b)=>Number(!!b.c.overdue)-Number(!!a.c.overdue)||(a.c.dueDay||Infinity)-(b.c.dueDay||Infinity))
 .slice(0,12).map(x=>'['+x.c.id+'] '+x.c.task+'；'+label(x.c)+'；进度为承办自报'+(Number(x.c.progress)||0)+'%；'+
 '复命状态：'+(x.c.reportState||'未报告')+'；期限第'+x.c.dueDay+'日'+(x.c.feedback?'；反馈：'+x.c.feedback:'')).join('\n');
}
function guardEdict(g,feedback) {
 if(!feedback||feedback.status!=='completed'||!feedback.edictId)return feedback;
 var linked=all(g).filter(x=>x.c.sourceId==='edict:'+feedback.edictId);
 var tracker=arr(g._edictTracker).find(e=>e.id===feedback.edictId);
 if(tracker&&['cancelled','revoked','rejected'].includes(tracker.status))return Object.assign({},feedback,{status:tracker.status,completionVerified:false});
 var proofs=TM.TaxPolicy.receipts(g,'edict:'+feedback.edictId);
 if(!linked.length&&!proofs.length)return feedback;
 var ok=linked.length?linked.every(x=>verified(g,x.c).ok):proofs.length>0;
 if(tracker){tracker.reportedStatus='completed';tracker.verificationStatus=ok?'verified':'pending_review';}
 return ok?Object.assign({},feedback,{completionVerified:true}):Object.assign({},feedback,{completionVerified:false,status:'executing',feedback:'承办自报完成，尚待核验。'+String(feedback.feedback||'')});
}
function acceptByPlayer(g,id){
 if(g.busy)return false;
 var found=all(g).filter(x=>x.c.id===id);
 if(found.length!==1||!alive(found[0].actor))return false;
 var c=found[0].c;if(c.status==='cancelled')return false;
 c.playerAcceptance={id:'player-acceptance:'+id,taskId:id,type:'player_review',turn:Number(g.turn)||0};
 update(g,found[0].name,c,{status:'completed',feedback:c.feedback||'御前验收通过'});
 return c.verificationStatus==='verified';
}
TM.ImperialOrders={create:create,all:all,update:update,updates:updates,fromDialogue:fromDialogue,
 tick:tick,ingestEdicts:ingestEdicts,verified:verified,context:context,label:label,guardEdict:guardEdict,
 mergeMemorials:mergeMemorials,acceptByPlayer:acceptByPlayer,refreshReports:refreshReports};
root.tmAcceptImperialTask=function(id){
 if(!root.GM||typeof root.confirm!=='function')return false;
 if(!root.confirm('确认已核对本项交办的执行结果？验收不会凭空改变税制、钱粮或军队。'))return false;
 var ok=acceptByPlayer(root.GM,id);
 if(ok&&typeof root._wdShowCommitTracker==='function')root._wdShowCommitTracker();
 return ok;
};
})(typeof window!=='undefined'?window:globalThis);
