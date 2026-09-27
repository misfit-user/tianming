// Connect recovery only at pre-application failure boundaries, after ordinary retries.
(function(root){
  'use strict';var TM=root.TM=root.TM||{};if(TM.RecoveryRuntime)return;
  function active(){
    if(!TM.EmergencyRecovery||!TM.RecoveryAdapters)return false;
    try{return TM.EmergencyRecovery.config().mode!=='off';}catch(_){return false;}
  }
  function options(opts){return TM.RecoveryAdapters.beginNormal(opts||{});}
  function attemptOptions(opts,ticket){return Object.assign({},opts,{maxRetries:0,_turnRetriesResolved:true,_configuredRetries:false,_normalRecoveryTicket:ticket,_recoveryValidationRetry:true});}
  function success(r,raw){return !!(r&&r.parsed&&!r.failed&&!r.truncated&&TM.RecoveryAdapters.sourcePreserved(raw,r));}
  function rejected(result,raw){return Object.assign({},result||{},{raw:raw,parsed:null,failed:true});}
  async function parse(raw,data,label,opts,normal){
    opts=opts||{};if(!active()||opts._emergency||/^emergency:/.test(opts.id||''))return normal(raw,data,label,opts);
    var A=TM.RecoveryAdapters,meta=A.normalMeta(data),resolved=options(Object.assign({},opts,{id:opts.id||meta&&meta.id||''}));
    if(!resolved.id)return normal(raw,data,label,opts);
    var ticket=meta||resolved._normalRecoveryTicket;ticket.attempts=Math.max(ticket.attempts,1);
    resolved._normalRecoveryTicket=ticket;A.assertNormal(ticket);A.markResponse(data,resolved);
    var currentRaw=raw,currentData=data,result=await normal(currentRaw,currentData,label,Object.assign({},opts,{repair:false}));
    A.assertNormal(ticket);if(success(result,currentRaw))return result;
    if(result&&result.truncated)return rejected(result,currentRaw);
    while(ticket.attempts<=ticket.limit&&opts.body&&opts.url&&typeof root._aiFetchWithRetry==='function'){
      var before=ticket.attempts;
      A.assertNormal(ticket);
      try { currentData=await root._aiFetchWithRetry(opts.url,opts.body,opts.signal||null,attemptOptions(Object.assign({},resolved,{apiKey:opts.key}),ticket)); }
      catch(error){
        A.assertNormal(ticket);
        if(!TM.CallRetryPolicy||!TM.CallRetryPolicy.retryable(error)||ticket.attempts===before)throw error;
        // Retain the earlier complete malformed response; HTTP pages are never repair input.
        continue;
      }
      if(ticket.attempts===before)throw TM.EmergencyRecovery.fault('RECOVERY_RETRY_ACCOUNTING','请求次数回执缺失，未绕过普通重试');
      if(currentData&&currentData.usage&&root.TokenUsageTracker)root.TokenUsageTracker.record(currentData.usage,resolved.id+':parse-retry');
      currentRaw=currentData&&currentData.choices&&currentData.choices[0]&&currentData.choices[0].message&&currentData.choices[0].message.content||'';
      result=await normal(currentRaw,currentData,label,Object.assign({},opts,{repair:false}));A.assertNormal(ticket);if(success(result,currentRaw))return result;if(result&&result.truncated)return rejected(result,currentRaw);
    }
    A.assertNormal(ticket);result=await normal(currentRaw,currentData,label,opts);A.assertNormal(ticket);if(success(result,currentRaw))return result;if(result&&result.truncated)return rejected(result,currentRaw);
    if(ticket.attempts<=ticket.limit||resolved.id==='sc1'&&!opts._finalEmergency)return rejected(result,currentRaw);
    var error=TM.EmergencyRecovery.fault('AI_PARSE_INVALID','普通重试和既有结构修复均未取得唯一合法结果');
    var schema=opts.body&&opts.body.response_format&&opts.body.response_format.json_schema&&opts.body.response_format.json_schema.schema;
    var recovered=await A.json({id:resolved.id,raw:currentRaw,error:error,normalExhausted:true,normalAttempts:ticket.attempts,tier:opts.tier||ticket.tier,signal:opts.signal,deadlineAt:ticket.deadlineAt,
      requestText:opts.body&&opts.body.messages?JSON.stringify(opts.body.messages):'',expectedKeys:opts.expectedKeys,
      validate:function(parsed){return (!opts.expectedKeys||!opts.expectedKeys.length||opts.expectedKeys.some(function(k){return Object.prototype.hasOwnProperty.call(parsed,k);}))&&(!schema||A.schemaOK(parsed,schema));}});
    if(recovered.error&&/^(AI_ABORTED|AI_STALE_WORLD|AI_REQUEST_DEADLINE|RECOVERY_DECLINED)$/.test(recovered.error.code))throw recovered.error;
    return recovered.ok?{parsed:recovered.value.parsed,raw:recovered.value.raw,repaired:true,truncated:false,emergencyReceipt:recovered.receipt}:Object.assign(rejected(result,currentRaw),{emergencyFailure:recovered.reason});
  }
  async function tools(prompt,definitions,opts,normal){
    if(!active()||opts&&opts._emergency||/^emergency:/.test(opts&&opts.id||''))return normal(prompt,definitions,opts);
    var A=TM.RecoveryAdapters,resolved=options(Object.assign({maxRetries:1},opts||{})),ticket=resolved._normalRecoveryTicket;
    var result=await normal(prompt,definitions,resolved);
    if(!result||!result._recoveryRawTools||result.truncated)return result;
    while(ticket.attempts<=ticket.limit){
      var before=ticket.attempts;result=await normal(prompt,definitions,attemptOptions(resolved,ticket));
      if(ticket.attempts===before)return {text:'',toolCalls:[],error:{code:'RECOVERY_RETRY_ACCOUNTING'}};
      if(!result||!result._recoveryRawTools||result.truncated)return result;
    }
    A.assertNormal(ticket);var rawCalls=result._recoveryRawTools;
    var adapter={sources:rawCalls.map(function(row,i){return {id:'tool:'+i,text:typeof row.arguments==='string'?row.arguments:JSON.stringify(row.arguments)};}),contract:{kind:'tool-arguments',tools:definitions,proposal:'{repairs:[{index:0,edits:[{start,end,expected,replacement}]}]}；仅修原参数字符串的分隔符，保留全部工具、调用顺序、参数值，不执行任何工具。'},
      preview:function(plan){try{
        if(!Array.isArray(plan.repairs))throw Error('缺少修复列表');var edits=new Map();
        plan.repairs.forEach(function(p){if(!Number.isInteger(p.index)||p.index<0||p.index>=rawCalls.length||edits.has(p.index))throw Error('非法或重复修复索引');edits.set(p.index,p.edits);});
        var calls=rawCalls.map(function(row,index){
          var def=definitions.find(function(d){return d.name===row.name;});if(!def||resolved.forceTool&&row.name!==resolved.forceTool)throw Error('未知工具不可改名后执行');
          var args=typeof row.arguments==='string'?(edits.has(index)?A.edited(row.arguments,edits.get(index)):row.arguments):JSON.stringify(row.arguments);
          var value=A.strict(args);if(!A.schemaOK(value,def.parameters||{}))throw Error('工具参数仍未通过原始契约');return {name:row.name,input:value};
        });
        return {ok:true,value:calls,verification:'所有原工具与参数值保留；恢复结果交回原 Agent 分派器验证和执行'};
      }catch(e){return {ok:false,code:'tool-repair-rejected',message:e.message};}}};
    var recovered=await TM.EmergencyRecovery.recover({id:resolved.id,kind:'tool-arguments',raw:JSON.stringify(rawCalls),requestText:prompt,adapter:adapter,error:{code:'tool-json-invalid'},normalExhausted:true,normalAttempts:ticket.attempts,safeBoundary:true,signal:resolved.signal,tier:resolved.tier,deadlineAt:ticket.deadlineAt});
    if(recovered.error&&/^(AI_ABORTED|AI_STALE_WORLD|AI_REQUEST_DEADLINE|RECOVERY_DECLINED)$/.test(recovered.error.code))throw recovered.error;
    return recovered.ok?{text:result.text,toolCalls:recovered.value,truncated:false,emergencyReceipt:recovered.receipt}:{text:'',toolCalls:[],error:{code:recovered.reason||'tool-json-invalid'}};
  }
  async function finalSC1(spec){
    var A=TM.RecoveryAdapters,ticket=A.normalMeta(spec.data);
    if(!active()||!ticket||ticket.attempts<=ticket.limit)return {ok:false,skipped:true};
    A.assertNormal(ticket);
    return A.json(Object.assign({},spec,{id:'sc1',deadlineAt:Math.min(ticket.deadlineAt,Number.isFinite(spec.deadlineAt)?spec.deadlineAt:Infinity),normalExhausted:true,normalAttempts:ticket.attempts,error:{code:'AI_PARSE_INVALID'},requestText:JSON.stringify(spec.body.messages),validate:function(p){return spec.validate(p)&&(!spec.body.response_format||!spec.body.response_format.json_schema||A.schemaOK(p,spec.body.response_format.json_schema.schema));}}));
  }
  TM.RecoveryRuntime={parse:parse,tools:tools,finalSC1:finalSC1};
})(typeof window!=='undefined'?window:globalThis);
