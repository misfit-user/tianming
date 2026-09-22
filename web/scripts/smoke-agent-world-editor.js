'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {loadFunctions}=require('./lib-save-commit-boundary');
const ROOT=path.resolve(__dirname,'..');
// Family ordering: tm-game-loop.js owns confirmation, then tm-game-loop-wentian-hardchange.js owns writes.
function fixture(){
 const c={console,GM:{turn:3,sid:'fixture',chars:[{id:'c1',name:'甲臣',alive:true},{id:'player',name:'天子',isPlayer:true,alive:true}],parties:[],classes:[],facs:[],armies:[]},P:{conf:{}},TM:{},_tmLoadGen:0,
  setTimeout:()=>0,clearTimeout(){},toast(){},addEB(){},_$:()=>null,_wtRenderHistory(){},_wtPending:null};
 c.window=c;c.globalThis=c;vm.createContext(c);
 loadFunctions(c,'tm-game-loop.js',['_wtConfirmPending']);
 for(const f of ['tm-indices.js','tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js','tm-social-formation.js','tm-agent-world-editor.js','tm-game-loop-wentian-hardchange.js','tm-endturn-agent-read-tools.js','tm-endturn-agent-write-tools.js','tm-wentian-agent.js','tm-endturn-agent-mode.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});
 c._wtAfterHardChange=()=>{};return c;
}
let n=0;function check(v,s){assert.ok(v,s);n++;}
(async()=>{
 const c=fixture(),W=c.TM.Endturn.AgentWriteTools,E=c.TM.AgentWorldEditor,R=c.TM.Endturn.AgentReadTools;
 check(W.isToolName('edit_world')&&W.defs().filter(x=>x.name==='edit_world').length===1,'main and review registry share one full game editor');
 c.TM.Endturn.AgentReadTools={defs:()=>[],handle:async()=>({ok:true,text:'在册党派为空'})};
 let request;
 c.callAIWithTools=async(prompt,tools)=>{request={prompt,tools};return{toolCalls:[{name:'submit_wentian',input:{category:'narrative',interpretation:'成立新党派并让甲臣入党',operations:[{tool:'edit_world',input:{operation:'append',path:'parties',value:{name:'革新党',leader:'甲臣',ideology:'兴利除弊'}},reason:'玩家明确要求成立新党派'}]}}]};};
 const result=await c.TM.WentianAgent.run('天意成立革新党',{forceCategory:'absolute'});
 check(result.ok&&result.result.category==='absolute','manual Tianyi category reaches the Agent');check(c.GM.parties.length===0,'planning does not preempt confirmation');
 check(request.prompt.includes('edit_world')&&request.tools.find(t=>t.name==='submit_wentian').parameters.properties.operations,'Agent sees real execution capability');
 c._wtPending={...result.result,raw:'天意成立革新党',turn:3,_world:c.GM,_player:c.P,_loadGen:0};c._wtConfirmPending();
 check(c.GM.parties.length===1&&c.GM.parties[0].name==='革新党','confirmation creates the real roster entity');
 check(c.GM.chars[0].partyId===c.GM.parties[0].id&&c.GM.parties[0].leaderId==='c1','party membership and leader references agree');
 check(c.GM._playerDirectives[0].operationReceipts[0].ok&&c.GM._playerDirectives[0]._immediatelyApplied,'success requires an actual execution receipt');
 c.GM.turn++;c.GM=JSON.parse(JSON.stringify(c.GM));
 check(c.GM.parties[0].name==='革新党'&&c.GM.parties[0].memberIds.includes('c1'),'next turn and save/reload preserve the new party');
 check(c._wtApplyHardChange('parties[新政党].ideology','set','清理积弊',{allowCreate:true}),'legacy absolute named path creates a real party');
 check(c.GM.parties.length===2&&!Object.prototype.hasOwnProperty.call(c.GM.parties,'新政党'),'no non-serializable array property');
 check(JSON.parse(JSON.stringify(c.GM)).parties[1].ideology==='清理积弊','new named path survives serialization');
 const creations=[['classes',{name:'新工匠',economicRole:'新式工场',reason:'玩家建立新阶层'}],['chars',{name:'新将领',age:28,alive:true}],['facs',{name:'新诸侯',leader:'新将领'}],['armies',{name:'新军',soldiers:1200,faction:'新诸侯',commander:'新将领'}]];
 const plan=creations.map(([kind,value])=>({tool:'edit_world',input:{path:kind,operation:'append',value},reason:'玩家天意直接建立新实体'}));
 const unchanged=JSON.stringify(c.GM),preview=E.preview(c.GM,plan);check(preview.ok,'all entity families can be previewed with their dependencies');check(JSON.stringify(c.GM)===unchanged,'preview never creates real entities');
 for(const op of plan){const r=W.handleSync(op.tool,{...op.input,reason:op.reason},{GM:c.GM});check(r.ok,op.input.path+' creation');}
 const saved=JSON.parse(JSON.stringify(c.GM));for(const [kind,v]of creations)check(saved[kind].some(x=>x.name===v.name&&x.id),kind+' has persistent stable ID');
 const army=saved.armies.find(x=>x.name==='新军'),commander=saved.chars.find(x=>x.name==='新将领');check(army.soldiers===1200&&army.strength===1200&&army.size===1200&&army.commanderId===commander.id,'army counters and commander aliases are consistent');
 check(saved.facs.find(x=>x.name==='新诸侯').leaderId===commander.id,'faction leader is linked to real character');
 check(saved.classes.find(x=>x.name==='新工匠').populationKeys.length===1,'new class uses canonical population binding');
 check(E.inspect(c.GM,{path:'armies.新军',length:6000}).text.includes('1200'),'console can query new state by entity name');
 for(const [kind,v]of creations){const read=await R.handle('list_entities',{kind:kind==='facs'?'factions':kind},{GM:c.GM});check(read.ok&&read.text.includes(v.name),kind+' is visible to next-turn Agent tools');}
 const field=await R.handle('get_field',{path:'armies[新军].commanderId'},{GM:c.GM});check(field.text.includes(commander.id),'named reads and writes use the same real entity');
 const nextPrompt=c.TM.Endturn.AgentMode.buildTurnPrompt({input:{}},JSON.parse(JSON.stringify(c.GM)));check(nextPrompt.includes('新军')&&nextPrompt.includes('新工匠')&&nextPrompt.includes('新诸侯'),'next-turn inference receives persisted authoritative edits');
 const repeated=W.handleSync('edit_world',{operation:'append',path:'parties',value:{name:'新政党'},reason:'复核同一项已完成指令'},{GM:c.GM});
 check(repeated.ok&&!repeated.changed&&c.GM.parties.length===2,'retry does not duplicate the party');
 const created=W.handleSync('edit_world',{operation:'set',path:'parties.御党',value:{leader:'天子',members:['天子'],ideology:'扶持新政'},reason:'玩家天意指定本人建党'},{GM:c.GM});
 check(created.ok&&c.GM.chars[1].party==='御党','explicit console authority may edit the player membership');
 check(E.handle(c.GM,{path:'customWorld.newRule',operation:'set',value:{enabled:true},reason:'补齐推演明确规则'}).ok,'review can create a previously absent world field');
 check(E.handle(c.GM,{path:'customWorld.newRule',operation:'merge',value:{cost:3},reason:'补充规则成本'}).ok,'game object merge');
 check(E.handle(c.GM,{path:'customWorld',operation:'remove',reason:'玩家撤销规则'}).ok&&!('customWorld'in c.GM),'remove really removes the own root');
 c.GM.guoku={money:100,balance:100};const fiscal=E.handle(c.GM,{path:'白银',operation:'add',value:25,reason:'控制台调整国库'});check(fiscal.ok&&fiscal.changed&&fiscal.old===100&&fiscal.new===125,'aliases report the actual canonical before and after values');
 c.P.worldSettings={season:'春'};const setting=E.handle(c.GM,{path:'P.worldSettings.season',operation:'set',value:'秋',reason:'天意改变世界季节'});check(setting.ok&&setting.changed&&c.P.worldSettings.season==='秋'&&E.read(c.GM,'P.worldSettings.season')==='秋','scenario business settings are editable and readable');
 c.GM.guoku.money=NaN;check(E.handle(c.GM,{path:'guoku.money',operation:'set',value:125,reason:'修复坏账数值'}).ok&&c.GM.guoku.money===125,'recovery can repair an invalid old scalar instead of rejecting its old value');
 for(const forbidden of ['turn','ai.key','P.ai.key','_endTurnCommitPending','parties.__proto__.polluted'])check(!E.handle(c.GM,{path:forbidden,operation:'set',value:1,reason:'invalid'}).ok,'transport and transaction boundary '+forbidden);
 const before=JSON.stringify(c.GM);check(!E.write(c.GM,'parties.99.name','set','越界',{allowCreate:true}).ok&&JSON.stringify(c.GM)===before,'failed edits are atomic');
 const rejected=c.TM.WentianAgent.applyOperations({operations:[{tool:'edit_world',input:{path:'testBusinessField',operation:'set',value:'不得残留'},reason:'试验整组提交'},{tool:'edit_world',input:{path:'chars',operation:'set',value:{}},reason:'错误的名册形状'}]});
 check(rejected.every(r=>!r.ok&&r.rolledBack)&&!('testBusinessField'in c.GM),'a failing batch cannot partially apply');
 c._wtPending={...result.result,raw:'旧世界命令',turn:3,_world:{},_player:c.P,_loadGen:0};c._wtConfirmPending();check(JSON.stringify(c.GM)===before,'stale pending command cannot affect another world');
 {
  const d=fixture();d.TM.Endturn.AgentReadTools={defs:()=>[],handle:async()=>({ok:true,text:''})};let calls=0;
  d.callAIWithTools=async()=>{calls++;const operations=calls===1?[{tool:'edit_world',input:{path:'armies',operation:'append',value:{name:'甲军',commander:'待建主帅',soldiers:600}},reason:'建立新军'}]:[{tool:'edit_world',input:{path:'chars',operation:'append',value:{name:'待建主帅'}},reason:'建立统帅'},{tool:'edit_world',input:{path:'armies',operation:'append',value:{name:'甲军',commander:'待建主帅',soldiers:600}},reason:'建立新军'}];return {toolCalls:[{name:'submit_wentian',input:{category:'absolute',interpretation:'建立新军',operations}}]};};
  const r=await d.TM.WentianAgent.run('天意组建甲军',{forceCategory:'absolute'});check(r.ok&&calls===2&&r.result.operations.length===2,'Agent receives real preview failures and repairs missing dependencies itself');check(d.GM.armies.length===0&&!d.GM.chars.some(x=>x.name==='待建主帅'),'planning repair stays isolated');
  calls=0;d.GM.custom={value:10};d.callAIWithTools=async()=>{calls++;return {toolCalls:[{name:'submit_wentian',input:{category:'absolute',operations:[{tool:'edit_world',input:{path:'custom.value',operation:'add',value:5},reason:'增加一次'}],hardChanges:calls===1?[{path:'custom.value',op:'add',value:5}]:[]}}]};};
  const once=await d.TM.WentianAgent.run('把数值增加五',{forceCategory:'absolute'});check(once.ok&&calls===2&&d.TM.WentianAgent.applyOperations(once.result).every(r=>r.ok)&&d.GM.custom.value===15,'legacy and current write plans cannot double-apply the same request');
  d.callAIWithTools=async()=>{d.GM={turn:99,parties:[]};return {toolCalls:[{name:'submit_wentian',input:{category:'absolute',interpretation:'旧世界结果'}}]};};
  const stale=await d.TM.WentianAgent.run('改旧世界',{forceCategory:'absolute'});check(!stale.ok&&stale.error==='world-changed','a late response cannot silently retarget another save');
 }
 console.log('[smoke-agent-world-editor] PASS '+n+' assertions');
})().catch(e=>{console.error(e);process.exitCode=1;});
