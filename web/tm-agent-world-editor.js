// Shared game-data editor for the console and simulation/recovery Agents.
(function(root){
  'use strict';
  var TM=root.TM=root.TM||{};
  var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
  var unsafe=/^(?:__proto__|constructor|prototype)$/i;
  var runtime=/^(?:ai|conf|turn|running|busy|sid|saveName|_campaignId|_timelineId|_indices|_endTurnCommitPending|_pendingShijiModal|_postTurnJobs|_postTurnDetachedJobs|_turnAiResults|_aiDispatchStats|_agentWriteLog|_agentWriteFailed|_agentOverrides|_turnReport|_saveMeta)$/;
  var rosters=new Set(['chars','facs','parties','classes','armies']);
  function json(v){
    if(v===undefined)return undefined;
    return JSON.parse(JSON.stringify(v,function(k,x){if(unsafe.test(k)||typeof x==='function'||typeof x==='symbol'||typeof x==='bigint'||typeof x==='number'&&!Number.isFinite(x))throw Error('仅可写入有效游戏数据');return x;}));
  }
  function existing(v,seen){
    if(!v||typeof v!=='object')return v;
    seen=seen||new Set();if(seen.has(v))throw Error('目标包含循环运行时对象');seen.add(v);
    var out=Array.isArray(v)?[]:{};Object.keys(v).forEach(function(k){if(unsafe.test(k))throw Error('目标包含非法原型字段');out[k]=existing(v[k],seen);});seen.delete(v);return out;
  }
  function parts(path){
    var p=String(path||'').trim().replace(/^GM\./i,'').replace(/\[([^\]]+)\]/g,function(_,k){return '.'+k.replace(/^['"]|['"]$/g,'');}).split('.');
    var aliases={characters:'chars',character:'chars',char:'chars',人物:'chars',factions:'facs',faction:'facs',fac:'facs',势力:'facs',party:'parties',党派:'parties',class:'classes',阶级:'classes',阶层:'classes',army:'armies',军队:'armies'};
    p[0]=aliases[p[0]]||p[0];
    if(!p.length||p.some(function(k){return !k||unsafe.test(k);})||runtime.test(p[0]))throw Error('目标不是可编辑的游戏内容');
    return p;
  }
  function keyAt(obj,key){
    if(!Array.isArray(obj))return key;
    if(/^\d+$/.test(key)){var n=Number(key);if(n>=obj.length)throw Error('数组下标越界，新增实体请用 append 或实体名称');return n;}
    var ids=obj.map(function(v,i){return v&&String(v.id)===key?i:-1;}).filter(function(i){return i>=0;});
    var hits=ids.length?ids:obj.map(function(v,i){return v&&v.name===key?i:-1;}).filter(function(i){return i>=0;});
    if(hits.length!==1)throw Error(hits.length?'实体名称不唯一':'实体不存在：'+key);
    return hits[0];
  }
  function read(g,path){if(typeof path==='string'&&/^P\./.test(path)){g=root.P;path=path.slice(2);}var p=Array.isArray(path)?path:parts(path),v=g;for(var i=0;i<p.length;i++){if(v==null)return undefined;var k=keyAt(v,p[i]);v=own(v,k)?v[k]:undefined;}return v;}
  function createEntity(g,kind,input,reason,preview){
    var data=json(input),list=g[kind]||[];
    if(!Array.isArray(list)||!data||typeof data!=='object'||Array.isArray(data)||typeof data.name!=='string'||!data.name.trim())throw Error('新实体需要有效名册和 name');
    var matches=list.filter(function(row){return row&&(row.name===data.name||data.id&&row.id===data.id);});
    if(matches.length>1||matches.length===1&&matches[0].name!==data.name)throw Error('实体 ID 或名称冲突');
    if(matches.length)return {ok:true,changed:false,verified:true,duplicate:true,path:kind+'.'+list.indexOf(matches[0]),new:json(matches[0])};
    var entity,result,options={source:'world-editor',authoritative:true,preview:!!preview,silentEB:!!preview,reason:reason,world:g};
    if(kind==='parties'||kind==='classes'){
      if(!TM.SocialFormation)throw Error('社会名册登记模块尚未加载');
      result=TM.SocialFormation[kind==='parties'?'createParty':'createClass'](g,Object.assign({},data,{reason:data.reason||reason}),options);
      if(!result.ok)throw Error(result.reason);entity=result.entity;
    }else if(kind==='chars'){
      if(!TM.Roster||!TM.Roster.createChar)throw Error('统一人物名册入口尚未加载');
      entity=TM.Roster.createChar(data,options);
    }else if(kind==='armies'){
      if(!TM.AIChange||!TM.AIChange.Army)throw Error('军队登记模块尚未加载');
      result=TM.AIChange.Army.applyAIArmyChange(Object.assign({},data,{action:'create',armyName:data.name,reason:reason}),options);
      if(!result.ok)throw Error(result.reason);entity=result.army;
    }else{
      entity=Object.assign({id:'world_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),sid:g.sid||'',_createdTurn:g.turn||0},kind==='facs'?{type:'地方势力',strength:0,economy:0,playerRelation:0}: {},data);
      g[kind]=list.concat([entity]);
      if(kind==='facs'&&entity.leader&&TM.AIChange&&TM.AIChange.Narrative)TM.AIChange.Narrative.setFactionLeader(entity,entity.leader,g,reason);
    }
    try{if(TM.Indices&&TM.Indices.invalidate)TM.Indices.invalidate(g,preview?null:root.P);}catch(_){}
    return {ok:true,changed:true,verified:true,created:true,path:kind+'.'+(entity.id||g[kind].indexOf(entity)),new:json(entity)};
  }
  function write(g,path,op,value,options){
    options=options||{};
    try{
      if(!g||typeof g!=='object')throw Error('没有当前世界');
      var p=parts(path),v=json(value),reason=String(options.reason||'问天天意直改'),allow=options.allowCreate===true;
      if(!['set','add','mul','merge','append','remove'].includes(op))throw Error('未知修改操作');
      if(op!=='remove'&&v===undefined)throw Error('缺少修改值');
      if((op==='add'||op==='mul')&&!Number.isFinite(v))throw Error('增减或倍乘需要有限数值');
      if(rosters.has(p[0])&&p.length===1&&['set','merge'].includes(op)&&!Array.isArray(v))throw Error('实体名册必须保持数组；新增一个实体用 append');
      if(rosters.has(p[0])&&p.length===1&&op==='append'){
        if(!v||typeof v!=='object'||Array.isArray(v))throw Error('新增实体需要完整对象');
        if(!allow)throw Error('此操作需要实体创建权限');
        return createEntity(g,p[0],v,reason,options.preview);
      }
      // Named array entries must be real elements. Array properties disappear in JSON saves.
      if(allow&&rosters.has(p[0])&&p.length>1&&!/^\d+$/.test(p[1])){
        var list=g[p[0]];
        if(list!=null&&!Array.isArray(list))throw Error('实体名册格式无效');
        list=list||[];var exists=list.some(function(x){return x&&(x.name===p[1]||String(x.id)===p[1]);});
        if(!exists){
          if(op==='remove')return {ok:true,changed:false,verified:true,path:p.join('.')};
          if(op!=='set'&&op!=='merge')throw Error('新增实体须 set 或 merge 明确初值');
          var entity=p.length===2?v:{name:p[1]};
          if(!entity||typeof entity!=='object'||Array.isArray(entity))throw Error('新实体需要对象');
          entity=Object.assign({name:p[1]},entity);
          if(p.length>2){var cursor=entity;for(var i=2;i<p.length-1;i++)cursor=cursor[p[i]]={};cursor[p[p.length-1]]=v;}
          return createEntity(g,p[0],entity,reason,options.preview);
        }
      }
      // Plan on a detached branch so an invalid leaf never leaves half-created parents.
      var branch={},base=p[0];branch[base]=existing(g[base]);
      if(p.length>1&&branch[base]==null){if(!allow)throw Error('目标不存在');branch[base]={};}
      var parent=branch;
      for(var j=0;j<p.length-1;j++){
        var k=keyAt(parent,p[j]);
        if(!own(parent,k)||parent[k]==null){if(!allow||Array.isArray(parent))throw Error('目标不存在');parent[k]={};}
        if(typeof parent[k]!=='object')throw Error('目标父级不是对象');parent=parent[k];
      }
      var last=keyAt(parent,p[p.length-1]),old=existing(parent[last]),next;
      if(op==='remove'){if(Array.isArray(parent))parent.splice(last,1);else delete parent[last];}
      else{
        if(!allow&&!own(parent,last))throw Error('字段不存在');
        if(op==='add'||op==='mul'){if(old!=null&&!Number.isFinite(old))throw Error('原值不是数值');next=op==='add'?(old||0)+v:(old||0)*v;}
        else if(op==='merge'){if(!v||typeof v!=='object'||Array.isArray(v)||old!=null&&(typeof old!=='object'||Array.isArray(old)))throw Error('merge 需要对象');next=Object.assign({},old||{},v);}
        else if(op==='append'){if(old!=null&&!Array.isArray(old))throw Error('append 需要数组');next=(old||[]).concat([v]);}
        else next=v;
        parent[last]=json(next);
      }
      if(p.length===1&&op==='remove')delete g[base];else g[base]=branch[base];
      var changed=JSON.stringify(old)!==JSON.stringify(next);
      try{if(TM.Indices&&TM.Indices.invalidate)TM.Indices.invalidate(g,options.preview?null:root.P);}catch(_){}
      return {ok:true,changed:changed,verified:true,path:p.join('.'),old:old,new:json(next)};
    }catch(e){return {ok:false,changed:false,reason:e.message};}
  }
  function handle(g,input){
    if(g!==root.GM)return {ok:false,reason:'目标世界已改变'};
    var path=String(input.path||''),op=input.operation||'set',reason=String(input.reason||'').trim();
    if(!reason)return {ok:false,reason:'须说明本次修改依据'};
    if(typeof root._wtNormalizeHardChangePath==='function')path=root._wtNormalizeHardChangePath(path);
    var target=/^P\./.test(path)?root.P:g,localPath=path.replace(/^P\./,'');
    try{parts(localPath);}catch(e){return {ok:false,reason:e.message};}
    var r,delegated=false;
    if(['set','add','mul'].includes(op)&&typeof root._wtApplyHardChange==='function'){
      delegated=true;
      var before;try{before=existing(read(target,localPath));}catch(_){}
      var ok=root._wtApplyHardChange(path,op,input.value,{allowCreate:true,reason:reason});
      var after;try{after=json(read(target,localPath));}catch(_){}
      r={ok:ok,changed:ok&&JSON.stringify(before)!==JSON.stringify(after),verified:ok,path:path,old:before,new:after,reason:ok?'':'游戏写入未完成'};
    }else {r=write(target,localPath,op,input.value,{allowCreate:true,reason:reason});if(target===root.P&&r.path)r.path='P.'+r.path;}
    if(r.ok&&r.changed){
      var entry={type:'change',path:r.path||path,old:r.old,new:r.new,reason:reason,turn:g.turn||0,_agent:true,_op:'edit_world'};
      if(!Array.isArray(g._agentWriteLog))g._agentWriteLog=[];g._agentWriteLog.push(entry);
      if(!Array.isArray(g._turnReport))g._turnReport=[];g._turnReport.push(entry);
      g._agentOverrides=g._agentOverrides||{};if(target===g)g._agentOverrides[parts(path)[0]]={turn:g.turn||0};
      note(g,r.path||path,reason);
      if(!delegated&&typeof root._wtAfterHardChange==='function')root._wtAfterHardChange(path,r.old,r.new);
    }
    return r;
  }
  var definition={name:'edit_world',description:'修改当前游戏任意业务内容与数据（默认GM；P.worldSettings等剧本业务字段可显式写P前缀）；可新建人物、党派、势力、阶层、军队及自定义字段，或修正现有内容。新实体用 append 到名册或 set parties.新党名 为完整对象；不能仅口头承诺。优先使用财政、人事等专用工具维护联动账。禁止操作接口配置、保存事务和回合运行锁。返回实际写入回执。',parameters:{type:'object',properties:{path:{type:'string'},operation:{type:'string',enum:['set','add','mul','merge','append','remove']},value:{},reason:{type:'string'}},required:['path','operation','reason']}};
  function note(g,path,reason){
    if(g!==root.GM)return;
    try{path=parts(path).join('.');}catch(_){return;}
    var rows=Array.isArray(g._worldEditorNotes)?g._worldEditorNotes:[];
    g._worldEditorNotes=rows.filter(function(r){return r.path!==path;}).concat([{path:path,reason:String(reason||'控制台修改'),turn:g.turn||0}]).slice(-60);
  }
  function context(g){
    var rows=(g._worldEditorNotes||[]).slice(-12).map(function(r){var value;try{value=read(g,r.path);}catch(_){value=undefined;}return {path:r.path,reason:r.reason,current:value===undefined?'[已删除或迁移]':JSON.stringify(value).slice(0,1600)};});
    return rows.length?'\n【已实际写入的控制台与Agent世界变更】以下是当前真实状态，后续推演应承接，不得恢复为初始剧本。复杂对象可用read_world按路径读全文。\n'+JSON.stringify(rows):'';
  }
  function inspect(g,input){
    input=input||{};var value=input.path?read(g,input.path):Object.keys(g).filter(function(k){return !runtime.test(k)&&typeof g[k]!=='function';}).map(function(k){return {path:k,type:Array.isArray(g[k])?'array':typeof g[k],count:Array.isArray(g[k])?g[k].length:undefined};});
    var text=JSON.stringify(value===undefined?null:value),offset=Math.max(0,Math.floor(Number(input.offset)||0)),length=Math.min(6000,Math.max(256,Math.floor(Number(input.length)||4096)));
    return {path:input.path||'',text:text.slice(offset,offset+length),total:text.length,next:offset+length<text.length?offset+length:null};
  }
  function preview(g,operations){
    try{
      var seen=new WeakSet(),copy=JSON.parse(JSON.stringify(g,function(k,v){if(runtime.test(k)||typeof v==='function')return undefined;if(v&&typeof v==='object'){if(seen.has(v))return undefined;seen.add(v);}return v;}));
      copy.turn=g.turn;copy.sid=g.sid;var receipts=[],copyP={};Object.keys(root.P||{}).forEach(function(k){if(!runtime.test(k))copyP[k]=json(root.P[k]);});
      for(var i=0;i<operations.length;i++){
        var op=operations[i];if(!op||op.tool!=='edit_world')return {ok:false,reason:'此预检接收 edit_world 操作；其他工具可查完整参数后使用'};
        var a=op.input||{},p=String(a.path||'');if(typeof root._wtNormalizeHardChangePath==='function')p=root._wtNormalizeHardChangePath(p);
        var r=write(/^P\./.test(p)?copyP:copy,p.replace(/^P\./,''),a.operation||'set',a.value,{allowCreate:true,reason:op.reason||a.reason,preview:true});
        receipts.push(r);if(!r.ok)return {ok:false,index:i,reason:r.reason,receipts:receipts};
      }
      return {ok:true,receipts:receipts};
    }catch(e){return {ok:false,reason:e.message};}
  }
  TM.AgentWorldEditor={write:write,handle:handle,read:read,inspect:inspect,preview:preview,note:note,context:context,definition:definition};
})(typeof window!=='undefined'?window:globalThis);
