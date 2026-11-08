// 回答解析不了就重新要（普通重试）。
// 11-08 同志定删掉「回合复核与应急推演」（每回合 Agent 复核、失败后应急修补、诏令金额恢复及其设置），
// 被掐断的回答由断处续（tm-ai-continuation.js）接着写；这里只留原来夹在其中的普通重试与它的记账：
//   · 每次调用一张重试票：次数上限、总期限、所属世界（读档、换存档、换接口后旧回答不再重试）；
//   · 回合子调用（_callEndturnAI）的 JSON 解析不了就按票重新要；截断的不收，交断处续、救援；
//   · 工具调用的参数写坏了同样重新要；
//   · 不再做应急修补：重试用完仍解析不了就照旧失败（主推演走救援、中止本回合，玩家可重来）。
// 对外名字沿用 TM.RecoveryAdapters / TM.RecoveryRuntime（tm-ai-infra*.js、tm-endturn-ai.js 按这两个名字调用）。
(function(root){
  'use strict';var TM=root.TM=root.TM||{};if(TM.RecoveryAdapters&&TM.RecoveryRuntime)return;
  var responseMeta=new WeakMap(), normalOwners=new WeakMap();
  function fault(code,message){var e=new Error(message||code);e.code=code;return e;}

  // ── 严格 JSON：逐词核对（不靠 JSON.parse 的宽容），用于判断「原样就是一个完整合法的 JSON」 ──
  function lex(text){
    var out=[],i=0,rx=/^(?:"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:])/;
    while(i<text.length){if(/\s/.test(text[i])){i++;continue;}var m=text.slice(i).match(rx);if(!m)throw Error('包含未知词法或未闭合字符串');out.push(m[0]);i+=m[0].length;}return out;
  }
  function strict(text){
    var t=lex(text),i=0;
    function value(depth){
      if(depth>100)throw Error('JSON 嵌套过深');var token=t[i++];
      if(token==='{'){var keys=new Set();if(t[i]==='}'){i++;return;}while(true){var k=t[i++];if(!k||k[0]!=='"'||t[i++]!==':')throw Error('对象字段结构错误');var name=JSON.parse(k);if(keys.has(name)||['__proto__','constructor','prototype'].includes(name))throw Error('重复或保留字段');keys.add(name);value(depth+1);if(t[i++]==='}')break;if(t[i-1]!==',')throw Error('缺少对象分隔');}return;}
      if(token==='['){if(t[i]===']'){i++;return;}while(true){value(depth+1);if(t[i++]===']')break;if(t[i-1]!==',')throw Error('缺少数组分隔');}return;}
      if(!token||!/^"|^(?:true|false|null)$|^-?\d/.test(token))throw Error('JSON 值无效');
      if(/^-?\d/.test(token)&&(!Number.isFinite(Number(token))||!/[.eE]/.test(token)&&!Number.isSafeInteger(Number(token))))throw Error('数值不能精确表示，须明确数值格式');
    }
    value(0);if(i!==t.length)throw Error('多个顶层值或尾随片段');return JSON.parse(text);
  }
  function unfence(text){return String(text||'').trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i,'$1');}
  // 主推演的旧记忆表侧通道（JSON 之后跟一段 <tableEdit>…</tableEdit>）：只核它的框架，原文照样交给 MemTables
  function legacyTableEnvelope(raw){
    var text=String(raw||'').trim(),fenced=/^```(?:json)?\s*\n/i.exec(text);
    if(fenced)text=text.slice(fenced[0].length);
    if(text[0]!=='{')return null;
    var depth=0,quoted=false,escaped=false,end=-1;
    for(var i=0;i<text.length;i++){
      var ch=text[i];
      if(escaped){escaped=false;continue;}
      if(quoted&&ch==='\\'){escaped=true;continue;}
      if(ch==='"'){quoted=!quoted;continue;}
      if(quoted)continue;
      if(ch==='{')depth++;else if(ch==='}'&&--depth===0){end=i+1;break;}
    }
    if(end<0)return null;
    var suffix=text.slice(end).trim();
    if(fenced){if(!suffix.startsWith('```'))return null;suffix=suffix.slice(3).trim();}
    var block=/^<tableEdit>([\s\S]*?)<\/tableEdit>$/i.exec(suffix);
    if(!block||/<\/?tableEdit\b/i.test(block[1]))return null;
    var commands=block[1].replace(/<!--([\s\S]*?)-->/g,'$1').trim();
    while(commands){
      var head=/^(insertRow|updateRow|deleteRow)\s*\(/.exec(commands);
      if(!head)return null;
      quoted=false;escaped=false;var close=-1;
      for(var j=head[0].length;j<commands.length;j++){
        var c=commands[j];
        if(escaped){escaped=false;continue;}
        if(quoted&&c==='\\'){escaped=true;continue;}
        if(c==='"'){quoted=!quoted;continue;}
        if(!quoted&&c===')'){close=j;break;}
      }
      if(close<0)return null;
      var args;try{args=strict('['+commands.slice(head[0].length,close)+']');}catch(_){return null;}
      var update=head[1]==='updateRow',remove=head[1]==='deleteRow';
      if(args.length!==(update?3:2)||!Number.isInteger(args[0])||args[0]<0)return null;
      if((update||remove)&&(!Number.isInteger(args[1])||args[1]<0))return null;
      var values=args[update?2:1];
      if(!remove&&(!values||typeof values!=='object'||Array.isArray(values)))return null;
      commands=commands.slice(close+1).replace(/^\s*;?/,'').trim();
    }
    return text.slice(0,end);
  }
  // 解析结果没丢原文的东西：原样就是合法 JSON，或修出来的与原文逐词一致（只差分隔符）
  function sourcePreserved(raw,result){
    if(!result||!result.parsed)return false;
    var source=unfence(raw),output=unfence(result.repaired?result.raw:JSON.stringify(result.parsed));
    try { if(!result.repaired){strict(source);return true;} } catch(_){}
    if(!result.repaired&&!result.truncated&&result.raw===raw){
      var envelope=legacyTableEnvelope(raw);
      if(envelope){try{strict(envelope);return true;}catch(_){}}
    }
    try {
      strict(output);
      var atoms=function(text){return lex(text).filter(function(token){return token!==','&&token!==':';});};
      return JSON.stringify(atoms(source))===JSON.stringify(atoms(output));
    }catch(_){return false;}
  }

  // ── 重试票：一次调用一张；attempts 由 _aiFetchWithRetry 每真发一次加一 ──
  function beginNormal(opts){
    var out=TM.CallRetryPolicy?TM.CallRetryPolicy.options(opts):Object.assign({},opts||{});
    if(!out._normalRecoveryTicket){
      var total=typeof root._aiTotalResponseTimeout==='function'?root._aiTotalResponseTimeout(out):0;
      out._normalRecoveryTicket={id:out.id||'',tier:out.tier||'primary',limit:out.maxRetries==null?3:Number(out.maxRetries),attempts:0,deadlineAt:Math.min(total>0?Date.now()+total:Infinity,out.retryBudget&&Number.isFinite(out.retryBudget.deadlineAt)?out.retryBudget.deadlineAt:Infinity)};
    }
    if(out._normalRecoveryTicket&&!normalOwners.has(out._normalRecoveryTicket)){
      var g=root.GM,p=root.P;
      normalOwners.set(out._normalRecoveryTicket,{gm:g,player:p,generation:root._tmLoadGen,world:JSON.stringify(g&&[g._campaignId,g._timelineId,g.turn]),api:JSON.stringify(p&&p.ai)});
    }
    assertNormal(out._normalRecoveryTicket);return out;
  }
  function assertNormal(ticket){
    var owner=ticket&&normalOwners.get(ticket);if(!owner)return;
    var g=root.GM,p=root.P;
    if(owner.gm!==g||owner.player!==p||owner.generation!==root._tmLoadGen||owner.world!==JSON.stringify(g&&[g._campaignId,g._timelineId,g.turn])||owner.api!==JSON.stringify(p&&p.ai))throw fault('AI_STALE_WORLD','原响应所属世界或接口已改变，不再重试旧调用');
    if(Number.isFinite(ticket.deadlineAt)&&Date.now()>=ticket.deadlineAt)throw fault('AI_REQUEST_DEADLINE','原调用明确总期限已到，不再重试');
  }
  function markResponse(data,opts){if(data&&typeof data==='object'&&opts&&opts._normalRecoveryTicket)responseMeta.set(data,opts._normalRecoveryTicket);return data;}
  function normalMeta(data){return data&&typeof data==='object'?responseMeta.get(data):null;}
  function claimNormal(opts){if(opts&&opts._normalRecoveryTicket)opts._normalRecoveryTicket.attempts++;}

  // 工具参数是否合原始契约（JSON Schema 子集；认不得的关键字一律不放行）
  function schemaOK(value,schema,top,depth){
    if(schema===true||schema==null)return true;if(schema===false||(depth||0)>60||typeof schema!=='object'||Array.isArray(schema))return false;
    top=top||schema;depth=(depth||0)+1;
    var has=function(k){return Object.prototype.hasOwnProperty.call(schema,k);};
    var known='$schema $id $ref $defs definitions $comment title description default examples deprecated readOnly writeOnly type enum const allOf anyOf oneOf not if then else properties patternProperties additionalProperties required minProperties maxProperties propertyNames dependencies dependentRequired dependentSchemas items prefixItems additionalItems minItems maxItems uniqueItems contains minContains maxContains minimum maximum exclusiveMinimum exclusiveMaximum multipleOf minLength maxLength pattern format';
    if(Object.keys(schema).some(function(k){return known.split(' ').indexOf(k)<0;}))return false;
    if(schema.$ref){
      if(!schema.$ref.startsWith('#/'))return false;
      var ref=schema.$ref.slice(2).split('/').reduce(function(v,k){return v&&v[k.replace(/~1/g,'/').replace(/~0/g,'~')];},top);
      if(ref===undefined||!schemaOK(value,ref,top,depth))return false;
    }
    if(schema.allOf&&!schema.allOf.every(function(s){return schemaOK(value,s,top,depth);}))return false;
    if(schema.anyOf&&!schema.anyOf.some(function(s){return schemaOK(value,s,top,depth);}))return false;
    if(schema.oneOf&&schema.oneOf.filter(function(s){return schemaOK(value,s,top,depth);}).length!==1)return false;
    if(has('not')&&schemaOK(value,schema.not,top,depth))return false;
    if(has('if')){var chosen=schemaOK(value,schema.if,top,depth)?'then':'else';if(has(chosen)&&!schemaOK(value,schema[chosen],top,depth))return false;}
    function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}';}
    if(has('const')&&canonical(value)!==canonical(schema.const))return false;
    if(schema.enum&&!schema.enum.some(function(v){return canonical(v)===canonical(value);}))return false;
    var type=value===null?'null':Array.isArray(value)?'array':typeof value;
    if(schema.type&&![].concat(schema.type).some(function(t){return t===type||t==='integer'&&type==='number'&&Number.isSafeInteger(value);}))return false;
    if(type==='number'){
      if(!Number.isFinite(value)||has('minimum')&&value<schema.minimum||has('maximum')&&value>schema.maximum)return false;
      if(typeof schema.exclusiveMinimum==='number'&&value<=schema.exclusiveMinimum||schema.exclusiveMinimum===true&&value<=schema.minimum||typeof schema.exclusiveMaximum==='number'&&value>=schema.exclusiveMaximum||schema.exclusiveMaximum===true&&value>=schema.maximum)return false;
      if(has('multipleOf')){var step=schema.multipleOf,ratio=value/step;if(!(step>0)||!Number.isFinite(ratio)||Math.abs(ratio-Math.round(ratio))>Number.EPSILON*Math.max(1,Math.abs(ratio))*4)return false;}
    }
    if(type==='string'){
      var length=Array.from(value).length;if(has('minLength')&&length<schema.minLength||has('maxLength')&&length>schema.maxLength)return false;
      if(schema.pattern){try{if(!new RegExp(schema.pattern,'u').test(value))return false;}catch(_){return false;}}
      if(schema.format){
        var formats={email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/,uuid:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,date:/^\d{4}-\d{2}-\d{2}$/,'date-time':/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/};
        if(!formats[schema.format]||!formats[schema.format].test(value))return false;
        if(schema.format==='date'&&(!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))return false;
        if(schema.format==='date-time'&&!Number.isFinite(Date.parse(value)))return false;
      }
    }
    if(type==='array'){
      if(has('minItems')&&value.length<schema.minItems||has('maxItems')&&value.length>schema.maxItems)return false;
      if(schema.uniqueItems&&new Set(value.map(canonical)).size!==value.length)return false;
      var tuple=Array.isArray(schema.prefixItems)?schema.prefixItems:Array.isArray(schema.items)?schema.items:null;
      if(!value.every(function(v,i){var rule=tuple?(i<tuple.length?tuple[i]:(Array.isArray(schema.prefixItems)?schema.items:schema.additionalItems)):schema.items;return rule===undefined||schemaOK(v,rule,top,depth);}))return false;
      if(has('contains')){var matches=value.filter(function(v){return schemaOK(v,schema.contains,top,depth);}).length;if(matches<(schema.minContains==null?1:schema.minContains)||has('maxContains')&&matches>schema.maxContains)return false;}
    }
    if(type==='object'){
      var keys=Object.keys(value);if(has('minProperties')&&keys.length<schema.minProperties||has('maxProperties')&&keys.length>schema.maxProperties)return false;
      if((schema.required||[]).some(function(k){return !Object.prototype.hasOwnProperty.call(value,k);}))return false;
      if(!keys.every(function(k){
        if(['__proto__','constructor','prototype'].includes(k)||has('propertyNames')&&!schemaOK(k,schema.propertyNames,top,depth))return false;
        var rules=[],props=schema.properties||{};if(Object.prototype.hasOwnProperty.call(props,k))rules.push(props[k]);
        try{Object.keys(schema.patternProperties||{}).forEach(function(p){if(new RegExp(p,'u').test(k))rules.push(schema.patternProperties[p]);});}catch(_){return false;}
        if(!rules.length&&has('additionalProperties'))rules.push(schema.additionalProperties);
        return rules.every(function(rule){return schemaOK(value[k],rule,top,depth);});
      }))return false;
      for(var family of ['dependencies','dependentRequired','dependentSchemas']){
        var dependencies=schema[family]||{};
        if(!Object.keys(dependencies).every(function(k){if(!Object.prototype.hasOwnProperty.call(value,k))return true;var rule=dependencies[k];return Array.isArray(rule)?rule.every(function(name){return Object.prototype.hasOwnProperty.call(value,name);}):schemaOK(value,rule,top,depth);}))return false;
      }
    }
    return true;
  }
  TM.RecoveryAdapters={strict:strict,sourcePreserved:sourcePreserved,schemaOK:schemaOK,beginNormal:beginNormal,markResponse:markResponse,normalMeta:normalMeta,assertNormal:assertNormal,claimNormal:claimNormal};

  // ── 回合子调用的解析：解析不了就按票重新要；截断的不收 ──
  function attemptOptions(opts,ticket){return Object.assign({},opts,{maxRetries:0,_turnRetriesResolved:true,_configuredRetries:false,_normalRecoveryTicket:ticket,_recoveryValidationRetry:true});}
  function success(r,raw){return !!(r&&r.parsed&&!r.failed&&!r.truncated&&sourcePreserved(raw,r));}
  function rejected(result,raw){return Object.assign({},result||{},{raw:raw,parsed:null,failed:true});}
  async function parse(raw,data,label,opts,normal){
    opts=opts||{};
    var meta=normalMeta(data),resolved=beginNormal(Object.assign({},opts,{id:opts.id||meta&&meta.id||''}));
    if(!resolved.id)return normal(raw,data,label,opts);
    var ticket=meta||resolved._normalRecoveryTicket;ticket.attempts=Math.max(ticket.attempts,1);
    resolved._normalRecoveryTicket=ticket;assertNormal(ticket);markResponse(data,resolved);
    var currentRaw=raw,currentData=data,result=await normal(currentRaw,currentData,label,Object.assign({},opts,{repair:false}));
    assertNormal(ticket);if(success(result,currentRaw))return result;
    if(result&&result.truncated)return rejected(result,currentRaw);
    while(ticket.attempts<=ticket.limit&&opts.body&&opts.url&&typeof root._aiFetchWithRetry==='function'){
      var before=ticket.attempts;
      assertNormal(ticket);
      try { currentData=await root._aiFetchWithRetry(opts.url,opts.body,opts.signal||null,attemptOptions(Object.assign({},resolved,{apiKey:opts.key}),ticket)); }
      catch(error){
        assertNormal(ticket);
        if(!TM.CallRetryPolicy||!TM.CallRetryPolicy.retryable(error)||ticket.attempts===before)throw error;
        continue; // 保留先前那份完整但写坏的回答；HTTP 错误页从不当修复材料
      }
      if(ticket.attempts===before)throw fault('RECOVERY_RETRY_ACCOUNTING','请求次数回执缺失，未绕过普通重试');
      if(currentData&&currentData.usage&&root.TokenUsageTracker)root.TokenUsageTracker.record(currentData.usage,resolved.id+':parse-retry');
      currentRaw=currentData&&currentData.choices&&currentData.choices[0]&&currentData.choices[0].message&&currentData.choices[0].message.content||'';
      result=await normal(currentRaw,currentData,label,Object.assign({},opts,{repair:false}));assertNormal(ticket);if(success(result,currentRaw))return result;if(result&&result.truncated)return rejected(result,currentRaw);
    }
    // 重试用完：最后用原调用自带的分隔符修复试一次（修出来须与原文逐词一致），仍不成就照旧失败
    assertNormal(ticket);result=await normal(currentRaw,currentData,label,opts);assertNormal(ticket);if(success(result,currentRaw))return result;
    return rejected(result,currentRaw);
  }

  // ── 工具调用：参数写坏了就按票重新要 ──
  async function tools(prompt,definitions,opts,normal){
    var resolved=beginNormal(Object.assign({maxRetries:1},opts||{})),ticket=resolved._normalRecoveryTicket;
    var result=await normal(prompt,definitions,resolved);
    if(!result||!result._recoveryRawTools||result.truncated)return result;
    while(ticket.attempts<=ticket.limit){
      var before=ticket.attempts;result=await normal(prompt,definitions,attemptOptions(resolved,ticket));
      if(ticket.attempts===before)return {text:'',toolCalls:[],error:{code:'RECOVERY_RETRY_ACCOUNTING'}};
      if(!result||!result._recoveryRawTools||result.truncated)return result;
    }
    return {text:'',toolCalls:[],error:{code:'tool-json-invalid'}};
  }
  TM.RecoveryRuntime={parse:parse,tools:tools};
})(typeof window!=='undefined'?window:globalThis);
