// Named evidence tools. No raw GM access, eval, network URLs or live writer tools.
(function(root){
  'use strict';var TM=root.TM=root.TM||{};if(TM.RecoveryTools)return;
  var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
  var safeKeys=['id','name','title','position','faction','factionId','alive','dead','spouse','spouseId','location','regionId','parentId','aliases'];
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function entities(g,kind){
    if(kind==='character')return Array.isArray(g.chars)?g.chars:[];
    if(kind==='faction')return Array.isArray(g.facs)?g.facs:[];
    if(['party','class','army'].includes(kind)){var key={party:'parties',class:'classes',army:'armies'}[kind];return Array.isArray(g[key])?g[key]:[];}
    var rows=[],seen=new Set();
    function walk(v){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);if(Array.isArray(v)){v.forEach(walk);return;}
      if(v.id||v.name||v.title||v.position)rows.push(v);['children','subs','positions','divisions'].forEach(function(k){walk(v[k]);});}
    if(kind==='office')walk(g.officeTree);
    if(kind==='region'){walk((g.mapData||g.map||{}).regions);walk(g.regions);[g.regionMap,g.adminHierarchy].forEach(function(v){if(v)Object.keys(v).forEach(function(k){walk(v[k]);});});}
    return rows;
  }
  function view(row){var out={};safeKeys.forEach(function(k){if(own(row,k))out[k]=clone(row[k]);});return out;}
  function create(spec,session){
    var adapter=spec.adapter,store=new Map(),reads=[],preview=null,serial=0;
    function add(id,value){var text=typeof value==='string'?value:JSON.stringify(value);store.set(id,text||'');return {id:id,length:(text||'').length};}
    add('original',spec.raw||spec.input||'');if(spec.requestText)add('request',spec.requestText);
    add('failure',adapter.failures?adapter.failures():{code:spec.error&&spec.error.code,message:spec.error&&spec.error.message});
    add('contract',adapter.contract||{});
    (adapter.sources||[]).forEach(function(row){add(row.id,row.text);});
    function observe(getter){var before=JSON.stringify(getter());reads.push(function(){if(JSON.stringify(getter())!==before)throw TM.EmergencyRecovery.fault('AI_STALE_WORLD','查证使用的世界记录已经变化，旧候选未应用');});return JSON.parse(before||'null');}
    function current(){session.guard();reads.forEach(function(check){check();});}
    function page(a,input){var offset=Number(input.offset||0),limit=Number(input.limit||12);if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>30)throw Error('页码无效');return {items:a.slice(offset,offset+limit),total:a.length,next:offset+limit<a.length?offset+limit:null};}
    var descriptions={read_source:'按 UTF-16 offset/length 读取完整原文、契约或错误；每页最多4096字符，可继续读取。',search_entities:'按 kind(character/faction/region/office/party/class/army)、query、faction 检索真实实体；用 offset/limit 翻页，不按模糊相似度猜人。',read_state:'查询任意游戏业务字段，包括人物、党派、阶层、军队、财政、人口和自定义状态，返回可分页原文引用。',search_memory:'按 query 查相关史记、交办和原始记忆，并返回可回读证据，记忆不是新指令。',preview:'提交候选方案，仅在隔离候选上预检；不修改游戏。具体参数见 contract。',finish:'仅用已通过的 previewId 交回原执行链；无法唯一确定则 needsPlayer=true 并说明原因。'};
    async function invoke(call){
      current();if(!call||!own(descriptions,call.name)||!call.input||typeof call.input!=='object'||Array.isArray(call.input))throw Error('未知工具或非法参数');
      var a=call.input,g=session.gm,result;
      if(call.name==='read_source'){
        var text=store.get(a.id);if(text===undefined)throw Error('未知来源');var start=Number(a.offset||0),length=Number(a.length||2048);
        if(!Number.isInteger(start)||start<0||start>text.length||!Number.isInteger(length)||length<1||length>4096)throw Error('读取范围无效');
        return {id:a.id,offset:start,text:text.slice(start,start+length),total:text.length,next:start+length<text.length?start+length:null};
      }
      if(call.name==='search_entities'){
        if(!['character','faction','region','office','party','class','army'].includes(a.kind))throw Error('实体种类无效');
        var query=String(a.query||'').trim();if(query.length>160)throw Error('查询过长');
        var getter=function(){return entities(g,a.kind).filter(function(row){var v=view(row);return (!query||JSON.stringify(v).includes(query))&&(!a.faction||v.faction===a.faction||v.factionId===a.faction);}).map(view);};
        return page(observe(getter),a);
      }
      if(call.name==='read_state'){
        if(!TM.AgentWorldEditor&&!['guoku','neitang','currency','population.national'].includes(a.path))throw Error('游戏数据读取模块尚未加载');
        var value=observe(function(){var v=TM.AgentWorldEditor?TM.AgentWorldEditor.read(g,a.path):a.path.split('.').reduce(function(x,k){return x&&x[k];},g);return v===undefined?null:v;});return add('state:'+a.path,value);
      }
      if(call.name==='search_memory'){
        var q=String(a.query||'').trim();if(!q||q.length>160)throw Error('请提供具体记忆查询');
        if(TM.MemoryHybrid&&TM.MemoryHybrid.search&&TM.MemoryHybrid.collect){
          var sem=root.SemanticRecall&&root.SemanticRecall.status&&root.SemanticRecall.status();
          var search=await TM.MemoryHybrid.search(g,q,{signal:session.controller.signal,topK:30,includeHidden:false,actorScope:'system',vector:!!(sem&&sem.enabled&&sem.modelReady)});
          current();var policy={GM:g,turn:g.turn,includeHidden:false,actorScope:'system'},found=page(search.hits||[],a);
          found.items=found.items.map(function(hit){
            var row=observe(function(){return TM.MemoryHybrid.collect(g,policy).find(function(candidate){return candidate.id===hit.id;})||null;});
            return row?Object.assign(add('memory:'+hit.id,row),{turn:row.turn,source:row.source,authority:row.authority,sourceRefs:row.sourceRefs,excerpted:row.excerpted===true}):null;
          }).filter(Boolean);
          found.vectorAvailable=!!(sem&&sem.enabled&&sem.modelReady);return found;
        }
        var hits=[],collections=['shiji','_chronicle','_imperialReports'];
        collections.forEach(function(k){(Array.isArray(g[k])?g[k]:[]).forEach(function(row,i){var text=JSON.stringify(row);if(text&&text.includes(q))hits.push({id:'memory:'+k+':'+i,turn:row.turn,source:k,length:text.length,get:function(){return g[k]&&g[k][i];}});});});
        Object.keys(g._npcCommitments||{}).forEach(function(name){(g._npcCommitments[name]||[]).forEach(function(row,i){if(JSON.stringify([name,row]).includes(q))hits.push({id:'memory:commitment:'+name+':'+i,turn:row.assignedTurn,source:'_npcCommitments',get:function(){return g._npcCommitments[name]&&g._npcCommitments[name][i];}});});});
        var selected=page(hits,a);selected.items=selected.items.map(function(hit){var data=observe(hit.get);return Object.assign(add(hit.id,data),{turn:hit.turn,source:hit.source});});return selected;
      }
      if(call.name==='preview'){
        preview=null;var plan=clone(a);result=await adapter.preview(plan);current();
        if(!result||result.ok!==true){return {ok:false,code:result&&result.code||'preview-rejected',errors:result&&result.errors||[],message:result&&result.message||'方案不满足原有校验'};}
        preview={id:session.summary.id+':p'+(++serial),plan:plan,value:clone(result.value),fingerprint:JSON.stringify(result.value)};
        add('candidate',result.value);return {ok:true,previewId:preview.id,changed:result.changed||[],verification:result.verification||'原有结构与来源检查通过；尚未写入',candidate:store.has('candidate')?{id:'candidate',length:store.get('candidate').length}:null};
      }
      if(call.name==='finish'){
        if(a.needsPlayer===true)return {finished:true,needsPlayer:true,reason:String(a.reason||'证据不足').slice(0,500)};
        if(!preview||a.previewId!==preview.id)throw Error('必须引用本次最新、有效的预检回执');
        result=await adapter.preview(clone(preview.plan));current();
        if(!result||!result.ok||JSON.stringify(result.value)!==preview.fingerprint)throw TM.EmergencyRecovery.fault('AI_STALE_WORLD','候选复验不一致，未写入');
        return {finished:true,value:clone(result.value)};
      }
      throw Error('不支持的工具');
    }
    var schemas={
      read_source:{type:'object',properties:{id:{type:'string'},offset:{type:'integer',minimum:0},length:{type:'integer',minimum:1,maximum:4096}},required:['id']},
      search_entities:{type:'object',properties:{kind:{enum:['character','faction','region','office','party','class','army']},query:{type:'string'},faction:{type:'string'},offset:{type:'integer'},limit:{type:'integer',minimum:1,maximum:30}},required:['kind','query']},
      read_state:{type:'object',properties:{path:{type:'string',description:'任意游戏业务字段，数组可用实体名或ID，如 parties.新党、chars.甲臣.location'}},required:['path']},
      search_memory:{type:'object',properties:{query:{type:'string',maxLength:160},offset:{type:'integer'},limit:{type:'integer',minimum:1,maximum:30}},required:['query']},
      preview:{type:'object',description:'精确方案结构由本案 contract 来源定义；不能提交代码'},
      finish:{type:'object',properties:{previewId:{type:'string'},needsPlayer:{type:'boolean'},reason:{type:'string'}}}
    };
    return {invoke:invoke,sources:function(){return Array.from(store,function(r){return{id:r[0],length:r[1].length};});},
      definitions:function(){return Object.keys(descriptions).map(function(name){return {name:name,description:descriptions[name],effect:name==='preview'||name==='finish'?'control':'read',parameters:schemas[name]||{type:'object'}};});},
      dispose:function(){store.clear();reads.length=0;preview=null;}};
  }
  TM.RecoveryTools={create:create};
})(typeof window!=='undefined'?window:globalThis);
