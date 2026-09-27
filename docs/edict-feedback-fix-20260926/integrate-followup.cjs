'use strict';
const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-endturn-ai-infer.js',s=>R(s,'        catch(writeError){',`        catch(writeError){
          if (TM.EdictEffects) TM.EdictEffects.cancel(GM);
          if (TM.EdictOutcomes) TM.EdictOutcomes.receive(GM,{edict_feedback:[]},ctx.input.edicts||{},GM.turn,[]);`));
edit('web/tm-endturn-ai-helpers.js',s=>{
 s=R(s,'  if (edictLines.length === 0) {',`  if (window.TM && TM.EdictOutcomes) {
    var _actualEdictReports=TM.EdictOutcomes.forTurn(GM,_auditTurn);
    if (_actualEdictReports.length) edictLines=_actualEdictReports.map(function(r){return {id:r.edictId,content:r.content,category:r.category};});
  }
  if (edictLines.length === 0) {`);
 s=R(s,'    edicts: edictLines,','    edicts: edictLines,\n    executionReceipts: window.TM && TM.EdictOutcomes ? TM.EdictOutcomes.forTurn(GM,_auditTurn) : [],');
 s=R(s,"    '\\n\\n【主推演叙事·时政记】\\n' + input.mainNarrative +", "    '\\n\\n【实际执行回执】\\n' + JSON.stringify(input.executionReceipts) +\n    '\\n\\n【主推演叙事·时政记】\\n' + input.mainNarrative +");
 s=R(s,'    GM._edictEfficacyHistory.push({',"    GM._edictEfficacyHistory = GM._edictEfficacyHistory.filter(function(r){return r.turn!==_auditTurn;});\n    GM._edictEfficacyHistory.push({");return s;
});
edit('web/tm-endturn-agent-write-tools.js',s=>{
 const anchor='  var SPECS = DEFS.map';if(!s.includes(anchor))throw Error('agent spec anchor');
 const pos=s.indexOf(anchor);s=s.slice(0,pos)+`  DEFS.push({name:'report_edict',description:'逐道回报诏令执行；数值操作先使用领域工具实际落账并带 edictId/effectId，本工具只关联执行记录与反馈，不再次改数值。',parameters:{type:'object',properties:{edictId:{type:'string'},status:{type:'string'},assignee:{type:'string'},feedback:{type:'string'},nextStep:{type:'string'},progressPercent:{type:'number'},clauses:{type:'array',items:{type:'object'}}},required:['edictId','status','feedback']}});
  DEFS.forEach(function(d){d.parameters.properties.edictId=d.parameters.properties.edictId||{type:'string',description:'若因诏令执行，填原诏令编号'};d.parameters.properties.effectId={type:'string',description:'本回合同一效果的稳定编号，重试沿用'};});
`.replace(/\n/g,'\r\n')+s.slice(pos);
 s=R(s,'    var reason = input.reason || \'agent 推演\';',`    var reason = input.reason || 'agent 推演';
    var resolutionTurn=ctx && ctx.input && ctx.input.resolutionTurn != null ? ctx.input.resolutionTurn : gm.turn;
    var edictToken=name==='report_edict'?null:TM.EdictOutcomes&&TM.EdictOutcomes.toolStart(gm,name,input,resolutionTurn);
    if(edictToken && edictToken.blocked)return {ok:false,changed:false,name:name,text:edictToken.reason};
    if(edictToken && edictToken.duplicate)return {ok:true,changed:false,verified:true,name:name,text:'该诏令效果已结算',result:edictToken.receipt};`);
 s=R(s,"      case 'judge_edict':          r = _semJudgeEdict(gm, input); break;", "      case 'judge_edict':          r = _semJudgeEdict(gm, input); break;\n      case 'report_edict':         r = TM.EdictOutcomes ? TM.EdictOutcomes.agentReport(gm,input,resolutionTurn) : {ok:false,reason:'诏令回报模块未加载'}; break;");
 return R(s,'    var reportAfter = gm && Array.isArray(gm._agentWriteLog) ? gm._agentWriteLog.length : 0;', '    if (TM.EdictOutcomes) TM.EdictOutcomes.toolFinish(gm,edictToken,name,input,r);\n    var reportAfter = gm && Array.isArray(gm._agentWriteLog) ? gm._agentWriteLog.length : 0;');
});
edit('web/tm-endturn-agent-mode.js',s=>{
 const line=s.split(/\r?\n/).find(l=>l.includes('var resolutionTurn ='));if(!line)throw Error('resolution turn');s=R(s,line,line+'\n    ctx.input.resolutionTurn=resolutionTurn;');
 s=R(s,"    var _edictDossier = TM.EdictOutcomes ? TM.EdictOutcomes.inputPrompt(gm,ctx.input.edicts || {},resolutionTurn) : '';", "    var _edictDossier = TM.EdictOutcomes ? TM.EdictOutcomes.inputPrompt(gm,ctx.input.edicts || {},resolutionTurn)+'\\n使用 report_edict 逐道回报；相关写工具须带 edictId 和稳定 effectId。回报使用工具已确认结果。' : '';");
 return R(s,"    _show('⟨执政⟩撰史定章…', 86);", "    if (TM.EdictOutcomes) TM.EdictOutcomes.receive(gm,{edict_feedback:[]},ctx.input.edicts||{},resolutionTurn,[]);\n    _show('⟨执政⟩撰史定章…', 86);");
});
edit('web/tm-endturn-agent-depth-tools.js',s=>{
 const line=s.split(/\r?\n/).find(l=>l.includes('var turn = gm.turn || 0; var digest = _turnDigest(gm);'));if(!line)throw Error('agent narrative digest');return R(s,line,line+'\n    if (TM.EdictOutcomes) digest += TM.EdictOutcomes.narrativeFacts(gm,ctx && ctx.input && ctx.input.resolutionTurn != null ? ctx.input.resolutionTurn : turn-1);');
});
edit('web/scripts/smoke-edict-efficacy.js',s=>{
 const a=s.indexOf("  const apply = fs.readFileSync(path.join(WEB, 'tm-endturn-apply.js'), 'utf8');",s.indexOf("test('main inference applies efficacy")),b=s.indexOf("  const ai =",a);if(a<0||b<a)throw Error('efficacy fixture');
 return s.slice(0,a)+`  const c=world(4);vm.runInContext(fs.readFileSync(path.join(WEB,'tm-edict-outcomes.js'),'utf8'),c);
  const e=edict({id:'exact-edict',turn:4});c.GM._edictTracker=[e];
  c.TM.EdictOutcomes.receive(c.GM,{edict_feedback:[{edictId:'wrong-id',content:e.content,status:'completed',feedback:'错误回报',efficacy:'standing'}]},[],4,[]);
  assert.equal(c.TM.EdictEfficacy.stateOf(e),'unjudged');assert.equal(e.status,'pending');
  c.TM.EdictOutcomes.receive(c.GM,{edict_feedback:[{edictId:e.id,content:e.content,status:'completed',feedback:'已颁行',efficacy:'standing'}]},[],4,[]);
  assert.equal(c.TM.EdictEfficacy.stateOf(e),'standing');assert.equal(e.status,'completed');
`.replace(/\n/g,'\r\n')+s.slice(b);
});
edit('web/scripts/smoke-shiji-volumes.js',s=>R(s,'  _edictEfficacyReport: {','  _edictEfficacyReport: {\n    turn: 11,'));
