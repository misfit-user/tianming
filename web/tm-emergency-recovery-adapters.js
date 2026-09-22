// Deterministic recovery certificates. Model proposals are data, not executable patches.
(function(root){
  'use strict';var TM=root.TM=root.TM||{};if(TM.RecoveryAdapters)return;
  var responseMeta=new WeakMap(), normalOwners=new WeakMap();
  function fail(code){return {ok:false,code:code};}function clone(v){return JSON.parse(JSON.stringify(v));}
  function lex(text){
    var out=[],i=0,rx=/^(?:"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:])/;
    while(i<text.length){if(/\s/.test(text[i])){i++;continue;}var m=text.slice(i).match(rx);if(!m)throw Error('包含未知词法或未闭合字符串');out.push(m[0]);i+=m[0].length;}return out;
  }
  function strict(text){
    var t=lex(text),i=0;
    function value(depth){
      if(depth>100)throw Error('JSON 嵌套过深');var token=t[i++];
      if(token==='{'){var keys=new Set();if(t[i]==='}'){i++;return;}while(true){var k=t[i++];if(!k||k[0]!=='"'||t[i++]!==':')throw Error('对象字段结构错误');var name=JSON.parse(k);if(keys.has(name)||['__proto__','constructor','prototype'].includes(name))throw Error('重复或保留字段不可自动修复');keys.add(name);value(depth+1);if(t[i++]==='}')break;if(t[i-1]!==',')throw Error('缺少对象分隔');}return;}
      if(token==='['){if(t[i]===']'){i++;return;}while(true){value(depth+1);if(t[i++]===']')break;if(t[i-1]!==',')throw Error('缺少数组分隔');}return;}
      if(!token||!/^"|^(?:true|false|null)$|^-?\d/.test(token))throw Error('JSON 值无效');
      if(/^-?\d/.test(token)&&(!Number.isFinite(Number(token))||!/[.eE]/.test(token)&&!Number.isSafeInteger(Number(token))))throw Error('数值不能精确表示，须明确数值格式');
    }
    value(0);if(i!==t.length)throw Error('多个顶层值或尾随片段');return JSON.parse(text);
  }
  function unfence(text){return String(text||'').trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i,'$1');}
  function edited(raw,edits){
    if(!Array.isArray(edits)||edits.length>80)throw Error('edits 数组无效');var last=raw.length+1,out=raw;
    edits.slice().sort(function(a,b){return b.start-a.start;}).forEach(function(e){
      if(!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end<e.start||e.end>raw.length||e.end>=last||raw.slice(e.start,e.end)!==e.expected||!/^[\s,:]*$/.test(e.replacement))throw Error('只能凭精确位置修复结构分隔符，不可改变值或括号');
      out=out.slice(0,e.start)+e.replacement+out.slice(e.end);last=e.start;
    });
    var scalars=function(s){return lex(s).filter(function(t){return t!==','&&t!==':';});};
    if(JSON.stringify(scalars(raw))!==JSON.stringify(scalars(out)))throw Error('修复改变了原值、顺序或结构层级');return out;
  }
  // SC1 has a legacy memory-table side channel. Certify its framing without
  // executing it; the unchanged raw response still reaches MemTables.
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
  function sourcePreserved(raw,result){
    if(!result||!result.parsed)return false;
    var source=unfence(raw),output=unfence(result.repaired?result.raw:JSON.stringify(result.parsed));
    try { if(!result.repaired){strict(source);return true;} } catch(_){}
    // Only the existing, completely framed side channel may follow the JSON.
    // Never certify a repaired/truncated response or discard any source bytes.
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
  function beginNormal(opts){
    var out=TM.CallRetryPolicy?TM.CallRetryPolicy.options(opts):Object.assign({},opts||{});
    if(!out._normalRecoveryTicket&&!out._emergency&&!/^emergency:/.test(out.id||'')){
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
    if(owner.gm!==g||owner.player!==p||owner.generation!==root._tmLoadGen||owner.world!==JSON.stringify(g&&[g._campaignId,g._timelineId,g.turn])||owner.api!==JSON.stringify(p&&p.ai))throw TM.EmergencyRecovery.fault('AI_STALE_WORLD','原响应所属世界或接口已改变，未启动旧结果恢复');
    if(Number.isFinite(ticket.deadlineAt)&&Date.now()>=ticket.deadlineAt)throw TM.EmergencyRecovery.fault('AI_REQUEST_DEADLINE','原调用明确总期限已到，未启动额外恢复');
  }
  function markResponse(data,opts){if(data&&typeof data==='object'&&opts&&opts._normalRecoveryTicket)responseMeta.set(data,opts._normalRecoveryTicket);return data;}
  async function json(spec){
    var raw=unfence(spec.raw),original;try{lex(raw);if(!raw.trim())return fail('empty-source');}catch(_){return fail('source-not-losslessly-repairable');}
    try{original=strict(raw);}catch(_){}
    var adapter={contract:{kind:'json',edits:'{edits:[{start,end,expected,replacement}]}；只能改冒号、逗号和结构空白，所有原值和括号须保留。合法字段归一由原调用先处理；本工具不改字段名或业务值。',expectedKeys:spec.expectedKeys||[],sourceOffsets:'original 内的 UTF-16 下标；保留所有中段数据，不能补造尾部'},
      preview:function(plan){try{
        var changed=plan.normalize===true?raw:edited(raw,plan.edits),parsed=strict(changed);
        if(plan.normalize===true)return fail('use-deterministic-normalization-first');
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return fail('expected-object');
        if(spec.validate&&!spec.validate(parsed))return fail('original-schema-rejected');
        return {ok:true,value:{parsed:parsed,raw:changed},verification:'所有原始值及顺序保留，唯一 JSON 与原调用字段门禁通过'};
      }catch(e){return {ok:false,code:'lossless-repair-rejected',message:e.message};}}};
    return TM.EmergencyRecovery.recover(Object.assign({},spec,{kind:'json',raw:raw,adapter:adapter,safeBoundary:true}));
  }
  function identityStamp(g,batch){
    var out=[],seen=new Set(),fields=new Set(['holder','holderId','characterId','incumbent','governor','leader','head']);
    Object.keys(batch||{}).forEach(function(key){
      if(!Array.isArray(batch[key]))return;
      batch[key].forEach(function(item){
        if(!item||typeof item!=='object')return;
        ['updates','changes'].forEach(function(k){
          var value=item[k];if(!value||Array.isArray(value)||typeof value!=='object')return;
          Object.keys(value).forEach(function(field){if(!['__proto__','constructor','prototype'].includes(field))fields.add(field);});
        });
      });
    });
    function values(row){
      return Array.from(fields,function(field){return [field,field.split('.').reduce(function(v,k){return v&&v[k];},row)];});
    }
    function walk(v){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);if(Array.isArray(v)){v.forEach(walk);return;}
      out.push([v.id,v.name,v.title,v.position,v.factionId,v.faction,v.alive,v.dead,v.aliases,values(v)]);
      ['children','subs','positions','divisions'].forEach(function(k){walk(v[k]);});
    }
    [g.chars,g.facs,g.officeTree,g.regions,(g.mapData||g.map||{}).regions].forEach(walk);
    [g.adminHierarchy,g.regionMap].forEach(function(v){if(v)Object.keys(v).forEach(function(k){walk(v[k]);});});
    return JSON.stringify(out);
  }
  async function identity(spec){
    var g=root.GM,before=identityStamp(g,spec.batch),originalGuard=spec.guard;
    spec=Object.assign({},spec,{guard:function(){if(originalGuard)originalGuard();if(root.GM!==g||identityStamp(g,spec.batch)!==before)throw TM.EmergencyRecovery.fault('AI_STALE_WORLD','恢复期间实体身份已变化，未将旧命令转给新人物');}});
    var adapter={contract:{kind:'identity',proposal:'{repairs:[{field,index,item:{完整修正项}}],semanticUnchanged:true,narrativePatch:""}',rules:'只可修复原始唯一姓名或其他已验证身份所指向的同一实体，查询结果只作证据，不允许换人或改变数额、动作、正文。'},failures:function(){return spec.validation.failures;},preview:function(plan){
      var patched=spec.repair(plan);if(!patched.ok)return patched;
      var checked=spec.validate(patched.output);if(!checked.ok)return {ok:false,code:'preflight-still-failing',errors:checked.failures};
      return {ok:true,value:checked.output,verification:'原有身份保护、业务字段等价检查和完整预检均通过；尚未应用'};
    }};
    return TM.EmergencyRecovery.recover(Object.assign({},spec,{kind:'identity',raw:JSON.stringify(spec.batch),adapter:adapter,safeBoundary:true}));
  }
  // Fail closed on unsupported assertion keywords; annotations do not confer permission.
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
      // Formats are not interpreted as arbitrary code or remote schemas.
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
  function normalMeta(data){return data&&typeof data==='object'?responseMeta.get(data):null;}
  function claimNormal(opts){if(opts&&opts._normalRecoveryTicket)opts._normalRecoveryTicket.attempts++;}
  TM.RecoveryAdapters={json:json,identity:identity,strict:strict,edited:edited,sourcePreserved:sourcePreserved,schemaOK:schemaOK,beginNormal:beginNormal,markResponse:markResponse,normalMeta:normalMeta,assertNormal:assertNormal,claimNormal:claimNormal};
})(typeof window!=='undefined'?window:globalThis);
