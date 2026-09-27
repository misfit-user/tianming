/* Link AI operations to edicts; measure actual state, reuse domain settlement and reject duplicate effects. */
(function(root){
  'use strict';
  var TM=root.TM=root.TM||{},sessions=new WeakMap();
  var FIELDS=['changes','anyPathChanges','fiscal_adjustments','currency_adjustments','population_adjustments','central_local_actions','institution_changes','char_updates','office_assignments','personnel_changes','class_changes','party_changes','class_updates','party_updates','party_relation_changes','army_changes','tax_reforms','building_changes'];
  var CORE={'民心':'minxin.trueIndex','吏治':'corruption.trueIndex','腐败':'corruption.trueIndex','皇威':'huangwei.index','皇权':'huangquan.index','内帑':'neitang.money','帑廪':'guoku.money','国库':'guoku.money'};
  function list(v){return Array.isArray(v)?v:[];}
  function clone(v){return v===undefined?null:JSON.parse(JSON.stringify(v));}
  function num(v){return typeof v==='number'&&isFinite(v);}
  function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
  function identity(v){if(Array.isArray(v))return v.map(identity);if(!v||typeof v!=='object')return v;var o={};Object.keys(v).sort().forEach(function(k){if(k==='reason'||k[0]==='_')return;o[k]=identity(v[k]);});return o;}
  function norm(p,G){p=String(p||'').replace(/^GM\./,'');if(CORE[p])return CORE[p];var bare=p.replace(/^vars\./,'').replace(/\.value$/,'');if(CORE[bare])return CORE[bare];if(G&&G.vars&&Object.prototype.hasOwnProperty.call(G.vars,bare))return 'vars.'+bare+'.value';if(/^vars\./.test(p))return p;var U=TM.AIChange&&TM.AIChange.PathUtils;return U?U.normalizeCoreVarPath(p):p;}
  function read(G,p){
    if(/^vars\./.test(p)){var k=p.slice(5).replace(/\.value$/,'');return clone(G.vars&&G.vars[k]&&G.vars[k].value);}
    var U=TM.AIChange&&TM.AIChange.PathUtils;if(U)return clone(U.resolvePath(G,p).value);
    return clone(String(p).split('.').reduce(function(v,k){return Array.isArray(v)?v.find(function(x){return x&&(x.name===k||String(x.id)===k);}):v&&v[k];},G));
  }
  function entity(G,bucket,ref){var all=list(G[bucket]),byId=all.filter(function(x){return x&&x.id!=null&&String(x.id)===String(ref);});if(byId.length)return byId.length===1?byId[0]:null;var byName=all.filter(function(x){return x&&x.name===ref;});return byName.length===1?byName[0]:null;}
  function labelFor(G,p){var core={'minxin.trueIndex':'民心','corruption.trueIndex':'吏治','huangwei.index':'皇威','huangquan.index':'皇权'};if(core[p])return core[p];if(/^vars\./.test(p))return p.slice(5).replace(/\.value$/,'');return p;}
  function identifiers(G,row){return list(row&&row._edictIds).concat(row&&row.edictId||row&&row.sourceEdictId||[]).filter(function(id,i,a){return a.indexOf(id)===i&&list(G._edictTracker).some(function(t){return t.id===id;});});}
  function descriptors(G,field,row,ref){
    var out=[],ids=identifiers(G,row),reason=String(row&&row.reason||'诏令执行');
    function add(p,requested,label){out.push({ref:ref,path:p,requested:requested,edictIds:ids,label:label||labelFor(G,p),reason:reason,visibility:/^(minxin|corruption)\./.test(p)?'reported':row.visibility==='hidden'?'hidden':'public'});}
    if(field==='changes'||field==='anyPathChanges'){add(norm(row.path,G),row.delta!==undefined?row.delta:row.value);}
    else if(field==='fiscal_adjustments'){
      var target=String(row.target||'');target=/^(内帑|内库|neicang)$/.test(target)?'neitang':/^(国库|帑廪|太仓)$/.test(target)?'guoku':target;
      add(target+'.'+(row.resource||'money'),row.amount,(target==='guoku'?'帑廪':target==='neitang'?'内帑':target)+'·'+(row.name||row.resource||'收支'));
    }else if(field==='class_changes'||field==='party_changes'){
      var bucket=field==='class_changes'?'classes':'parties',obj=entity(G,bucket,row.name);var name=obj&&(obj.id||obj.name)||row.name;
      ['satisfaction','influence','cohesion'].forEach(function(k){if(row[k+'_delta']!==undefined)add(bucket+'.'+name+'.'+k,row[k+'_delta'],row.name+'·'+({satisfaction:'满意度',influence:'影响力',cohesion:'凝聚力'}[k]));});
    }else if(field==='class_updates'||field==='party_updates'||field==='char_updates'){
      var b=field==='class_updates'?'classes':field==='party_updates'?'parties':'chars',o=entity(G,b,row.name),r=row.updates||row;
      Object.keys(r).forEach(function(k){if(['name','reason','edictId','sourceEdictId','_edictIds'].indexOf(k)>=0)return;var key=k.replace(/_delta$/,'');if(o&&Object.prototype.hasOwnProperty.call(o,key))add(b+'.'+(o.id||o.name)+'.'+key,r[k],row.name+'·'+key);});
    }else if(field==='army_changes'){
      var a=entity(G,'armies',row.name);['soldiers','morale','training','supply'].forEach(function(k){if(row[k+'_delta']!==undefined)add('armies.'+(a&&(a.id||a.name)||row.name)+'.'+k,row[k+'_delta'],row.name+'·'+k);});
    }else if(field==='office_assignments'||field==='personnel_changes'){
      var ch=entity(G,'chars',row.name||row.character);if(ch)['officialTitle','alive','faction','status'].forEach(function(k){if(ch[k]!==undefined)add('chars.'+(ch.id||ch.name)+'.'+k,null,(ch.name||'')+'·'+k);});
    }else if(field==='party_relation_changes'){
      ['alliedWith','conflictWith'].forEach(function(k){add('partyState.'+row.party+'.'+k,row.relation,row.party+'·'+k);});
    }
    if(!out.length&&ids.length)out.push({ref:ref,path:'',edictIds:ids,reason:reason,label:field,visibility:row.visibility==='hidden'?'hidden':'public',status:'unverified',note:'该事项须核对对应领域的执行记录。'});
    return out;
  }
  function bind(G,p1){
    var refs={};FIELDS.forEach(function(k){list(p1[k]).forEach(function(row,i){if(!row||typeof row!=='object')return;var ref=typeof row._edictRef==='string'&&new RegExp('^'+k+'\\[\\d+\\]$').test(row._edictRef)?row._edictRef:k+'['+i+']';row._edictRef=ref;row._edictIds=[];refs[ref]=row;});});
    list(p1.edict_feedback).forEach(function(f){
      var t=TM.EdictOutcomes&&TM.EdictOutcomes.match(G,f,G.turn);if(!t)return;
      var all=list(f.effectRefs);list(f.clauses).forEach(function(c){all=all.concat(list(c.effectRefs));});
      all.forEach(function(ref){var op=refs[ref];if(op){var explicit=op.edictId||op.sourceEdictId;if(explicit&&explicit!==t.id)return;op._edictIds=list(op._edictIds);if(op._edictIds.indexOf(t.id)<0)op._edictIds.push(t.id);}});
    });return refs;
  }
  function begin(G,P,ctx,p1){
    ctx.apply=ctx.apply||{};ctx.apply.edictOriginalOutput=clone(p1);
    var turn=Number(ctx&&ctx.input&&ctx.input.resolutionTurn||G.turn)||0,refs=bind(G,p1),descs=[],aux=[],seen={};
    // Resolve links before normalizing indices. A repeated same-turn operation is never re-applied.
    FIELDS.forEach(function(field){
      if(!Array.isArray(p1[field]))return;
      p1[field]=p1[field].filter(function(row,i){
        if(!row||typeof row!=='object')return true;
        if(/^(class|party)_(changes|updates)$/.test(field)){var target=entity(G,field.indexOf('class')===0?'classes':'parties',row.id||row.classId||row.partyId||row.name);if(target)row.name=target.name;}
        var ref=row._edictRef||field+'['+i+']',ds=descriptors(G,field,row,ref),ids=identifiers(G,row);
        if((row.edictId||row.sourceEdictId)&&!ids.length)return false;
        if((field==='changes'||field==='anyPathChanges')&&row.delta!==undefined&&ds.length===1&&/^(guoku|neitang)\.(money|grain|cloth)$/.test(ds[0].path)){
          var fiscalDuplicate=list(p1.fiscal_adjustments).some(function(f,j){var fd=descriptors(G,'fiscal_adjustments',f,'fiscal_adjustments['+j+']')[0];return fd&&fd.path===ds[0].path&&Number(f.amount)*(f.kind==='expense'?-1:1)===row.delta&&(!ids.length||ids.some(function(id){return fd.edictIds.indexOf(id)>=0;}));});
          if(fiscalDuplicate)return false;
        }
        var inTransit=ids.length&&ids.every(function(id){var t=G._edictTracker.find(function(x){return x.id===id;});return list(t._letterIds).some(function(lid){var letter=list(G.letters).find(function(l){return l.id===lid;});return !letter||['delivered','returned','replying'].indexOf(letter.status)<0;});});
        if(inTransit){ds.forEach(function(d){d.before=read(G,d.path);d.status='blocked';d.note='信使尚未送达，效果未执行';descs.push(d);});return false;}
        var key=field+'|'+ids.slice().sort().join(',')+'|'+(row.effectId||JSON.stringify(identity(row)));
        row._edictRef=ref;
        var prior=ids.length&&ids.every(function(id){var t=G._edictTracker.find(function(x){return x.id===id;});return list(t._appliedEffects).some(function(e){return e.turn===turn&&e.key===key;});});
        if(prior)return false;
        if(ids.length&&seen[key]){ds.forEach(function(d){d.status='duplicate';});return false;}
        if(ids.length)seen[key]=true;
        if(ids.length)ds.forEach(function(d){d.key=key;d.before=read(G,d.path);descs.push(d);});return true;
      });
    });
    function auxiliary(key,value,ids,ref,reason){
      var p=norm(key,G),same=descs.find(function(d){return d.path===p&&(ids.some(function(id){return d.edictIds.indexOf(id)>=0;})||!ids.length&&d.requested===value);});
      if(same)return;
      if(ref.indexOf('edict_lifecycle_update.')===0&&ids.length&&ids.every(function(id){var t=G._edictTracker.find(function(x){return x.id===id;});return list(t._appliedEffects).some(function(e){return e.turn===turn&&e.path===p;});}))return;
      var keyId='numeric|'+p+'|'+JSON.stringify(value)+'|'+ids.join('|');
      if(ids.length&&ids.every(function(id){var t=G._edictTracker.find(function(x){return x.id===id;});return list(t._appliedEffects).some(function(e){return e.turn===turn&&e.key===keyId;});}))return;
      var d={ref:ref,path:p,requested:value,before:read(G,p),edictIds:ids,key:keyId,label:labelFor(G,p),reason:reason||'诏令执行',visibility:/^(minxin|corruption)\./.test(p)?'reported':'public'};
      aux.push(d);descs.push(d);
    }
    Object.keys(p1.resource_changes||{}).forEach(function(k){var ids=[];list(p1.edict_feedback).forEach(function(f){if(list(f.effectRefs).indexOf('resource_changes.'+k)>=0){var t=TM.EdictOutcomes.match(G,f,turn);if(t)ids.push(t.id);}});auxiliary(k,p1.resource_changes[k],ids,'resource_changes.'+k);});
    p1.resource_changes={};
    list(p1.edict_lifecycle_update).forEach(function(u){
      var t=TM.EdictOutcomes&&TM.EdictOutcomes.match(G,u,turn);if(!t)return;
      Object.keys(u.currentEffects||{}).forEach(function(k){auxiliary(k,u.currentEffects[k],[t.id],'edict_lifecycle_update.'+t.id+'.currentEffects.'+k,u.resistanceDescription||'诏令阶段效果');});
      Object.keys(u.classesAffected||{}).forEach(function(name){var a=u.classesAffected[name]||{},obj=entity(G,'classes',name);if(!obj)return;auxiliary('classes.'+(obj.id||obj.name)+'.satisfaction',a.impact,[t.id],'edict_lifecycle_update.'+t.id+'.classesAffected.'+name,a.reason);});
      Object.keys(u.partiesAffected||{}).forEach(function(name){var a=u.partiesAffected[name]||{},obj=entity(G,'parties',name);if(!obj)return;auxiliary('parties.'+(obj.id||obj.name)+'.influence',a.influence_delta,[t.id],'edict_lifecycle_update.'+t.id+'.partiesAffected.'+name,a.reason);});
      // Lifecycle stages retain narrative/agenda, but their numbers are settled through the same domain owners.
      u._effectsRouted=true;
    });
    var state={turn:turn,descriptors:descs,auxiliary:aux,ctx:ctx};sessions.set(G,state);
    ctx.apply=ctx.apply||{};ctx.apply.edictEffectState=state;return state;
  }
  function partyNumeric(G,p,field,delta,reason,sourceRow){
    if(!p||!num(p[field]))return {ok:false,reason:'党派字段未定义'};
    var old=p[field],budgetKey=field==='cohesion'?'_cohesionCalibrationBudget':'_edictInfluenceBudget',budget=p[budgetKey];
    if(!budget||budget.turn!==G.turn||!num(budget.net))budget=p[budgetKey]={turn:G.turn,net:0};
    var applied=clamp(clamp(delta,-15,15),-Math.max(0,15+budget.net),Math.max(0,15-budget.net));
    p[field]=Math.round(clamp(old+applied,0,100)*100)/100;budget.net+=p[field]-old;
    var ps=G.partyState&&G.partyState[p.name];if(ps){ps[field]=p[field];ps['_synced_'+field]=p[field];if(!Array.isArray(ps.historyLog))ps.historyLog=[];ps.historyLog.push({turn:G.turn,field:field,delta:p[field]-old,reason:reason});if(ps.historyLog.length>16)ps.historyLog=ps.historyLog.slice(-16);}
    if(typeof root.recordChange==='function')root.recordChange('parties',p.name,field,old,p[field],reason);
    var result={ok:true,old:old,new:p[field],delta:p[field]-old};recordApplied(G,sourceRow,result,'parties.'+(p.id||p.name)+'.'+field);return result;
  }
  function applyNumeric(G,path,value,op,reason){
    path=norm(path,G);var old=read(G,path),delta=op==='set'?value-old:value,res=null;
    var supported=/^((guoku|neitang)\.(money|grain|cloth)|huangwei\.index|huangquan\.index|minxin\.trueIndex|corruption\.trueIndex|vars\..+\.value|classes\.[^.]+\.(satisfaction|influence)|parties\.[^.]+\.(influence|cohesion))$/.test(path);
    if(!supported)return null;
    if(!num(value)||!num(old))return {ok:false,path:path,reason:'目标或变更不是有效数值'};
    if(!delta)return {ok:true,path:path,old:old,new:old,delta:0};
    reason=String(reason||'诏令执行');
    if(/^(guoku|neitang)\./.test(path)){
      var bits=path.split('.'),FE=root.FiscalEngine,fn=FE&&FE[(delta<0?'spendFrom':'addTo')+(bits[0]==='neitang'?'Neitang':'Guoku')];
      if(!fn)return {ok:false,path:path,reason:'财政账本未加载'};var amount={};amount[bits[1]]=Math.abs(delta);res=fn(amount,reason);
    }else if(path==='minxin.trueIndex'){
      if(!TM.MinxinLedger)return {ok:false,path:path,reason:'民心账本未加载'};
      res=TM.MinxinLedger.recordAndApply(G,{sourceSystem:'edict-effect',kind:'edict',delta:delta,reason:reason},{turn:G.turn,source:'edict-effect'});
    }else if(path==='huangwei.index'||path==='huangquan.index'){
      var fn=root.AuthorityEngines&&(path==='huangwei.index'?root.AuthorityEngines.adjustHuangwei:root.AuthorityEngines.adjustHuangquan);
      if(!fn)return {ok:false,path:path,reason:'权力机制未加载'};res=fn('edict-effect',delta,reason);
    }else if(path==='corruption.trueIndex'){
      if(!root.CorruptionEngine||!root.CorruptionEngine.applyEdictDelta)return {ok:false,path:path,reason:'吏治写入口未加载'};
      res=root.CorruptionEngine.applyEdictDelta(delta,reason);
    }else if(path.indexOf('vars.')===0){
      var k=path.slice(5,-6),v=G.vars[k];if(!v||v.readonly||v.readOnly||v.derived||v.formula)return {ok:false,path:path,reason:'派生变量须改变其基础数据'};
      v.value=clamp(old+delta,num(v.min)?v.min:-Infinity,num(v.max)?v.max:Infinity);
      if(typeof root._enforceFormulas==='function'){var changes={};changes[k]=v.value-old;root._enforceFormulas(changes);}
      var U=TM.AIChange&&TM.AIChange.PathUtils;if(U&&U.recordToTurnChanges)U.recordToTurnChanges(path,old,v.value,reason);
    }else{
      var m=path.split('.'),obj=entity(G,m[0],m[1]);
      if(m[0]==='parties')return Object.assign(partyNumeric(G,obj,m[2],delta,reason),{path:path});
      if(!TM.ClassEngine||!obj)return {ok:false,path:path,reason:'阶层机制或对象未加载'};
      var change={name:obj.name,reason:reason};change[m[2]+'_delta']=delta;
      if(m[2]==='satisfaction'){
        var gate=TM.ClassEngine.gateSatisfaction(G,obj,clamp(delta,-12,12),{turn:G.turn,source:'edict-effect',reason:reason});
        if(gate.approved&&TM.ClassEngine.applyClassPartyCoupling)TM.ClassEngine.applyClassPartyCoupling(G,obj,gate.approved,{turn:G.turn,source:'edict-effect',reason:reason});
      }else obj.influence=clamp(old+clamp(delta,-8,8),0,100);
      if(typeof root.recordChange==='function')root.recordChange('classes',obj.name,m[2],old,obj[m[2]],reason);
    }
    var after=read(G,path);if(res&&res.ok===false&&after===old)return {ok:true,path:path,old:old,new:after,delta:0,note:res.reason||'未获准变化'};
    return {ok:true,path:path,old:old,new:after,delta:after-old,reason:reason};
  }
  function applyAuxiliary(G,ctx){
      var s=ctx&&ctx.apply&&ctx.apply.edictEffectState;if(!s)return;
    s.auxiliary.forEach(function(d){var r=applyNumeric(G,d.path,d.requested,'delta',d.reason);if(!r||!r.ok){d.status='blocked';d.note=r&&r.reason||'须通过对应领域的结构化操作结算';}else{d.before=r.old;d.after=r.new;d.status=r.old===r.new?'unchanged':'applied';if(r.note)d.note=r.note;}});
  }
  function recordApplied(G,row,result,path){
    var s=sessions.get(G);if(!s||!row||!row._edictRef||!result)return;
    path=norm(path||result.path||row.path,G);
    s.descriptors.forEach(function(d){if(d.ref!==row._edictRef||d.path!==path)return;
      if(result.old!==undefined)d.before=clone(result.old);d.after=result.new!==undefined?clone(result.new):read(G,path);d.perOperation=true;
      d.status=result.ok===false?'blocked':result.executionStatus==='partial'?'partial':result.executionStatus==='blocked'?'blocked':result.executionStatus==='scheduled'?'recorded':JSON.stringify(d.before)===JSON.stringify(d.after)?'unchanged':'applied';
      if(result.shortfall)d.shortfall=result.shortfall;
      d.note=result.shortfall?'申请 '+d.requested+'，尚缺 '+result.shortfall:result.executionStatus==='scheduled'?'已登记按期结算。':result.note||result.reason||'';
    });
  }
  function finish(G,ctx,p1,failed){
    var s=ctx&&ctx.apply&&ctx.apply.edictEffectState;if(!s)return [];
    var groups={};s.descriptors.forEach(function(d){if(d.path)(groups[d.path]||(groups[d.path]=[])).push(d);});
    s.descriptors.forEach(function(d){
      if(failed){d.after=read(G,d.path);d.status=d.path&&d.before!==null&&JSON.stringify(d.before)!==JSON.stringify(d.after)?'applied':'unverified';d.note='本次写回未全部完成，尚待补正。';}
      if(!d.status){d.after=read(G,d.path);d.status=d.before===null&&d.after===null?'unverified':JSON.stringify(d.before)===JSON.stringify(d.after)?'unchanged':'applied';}
      d.shared=d.edictIds.length>1||!d.perOperation&&!!(groups[d.path]&&groups[d.path].length>1);
      if(['applied','unchanged','partial','recorded'].indexOf(d.status)>=0)d.edictIds.forEach(function(id){var t=G._edictTracker.find(function(x){return x.id===id;});if(!Array.isArray(t._appliedEffects))t._appliedEffects=[];if(!t._appliedEffects.some(function(e){return e.turn===s.turn&&e.key===d.key&&e.path===d.path;}))t._appliedEffects.push({turn:s.turn,key:d.key,path:d.path});t._appliedEffects=t._appliedEffects.filter(function(e){return e.turn>=s.turn-2;});});
    });
    ctx.apply.edictEffects=clone(s.descriptors.filter(function(d){return d.edictIds.length;}));sessions.delete(G);return ctx.apply.edictEffects;
  }
  function route(G,path,value,op,reason){return sessions.has(G)?applyNumeric(G,path,value,op,reason):null;}
  function fail(G,ctx){var receipts=finish(G,ctx,null,true);if(ctx.apply&&ctx.apply.edictOriginalOutput)ctx.results.sc1=ctx.apply.edictOriginalOutput;return receipts;}
  function catalog(G){return {variables:Object.keys(G.vars||{}).filter(function(k){return G.vars[k]&&num(G.vars[k].value);}).map(function(k){var v=G.vars[k];return {name:k,value:v.value,unit:v.unit||'',min:v.min,max:v.max,derived:!!(v.derived||v.formula||v.readonly||v.readOnly)};}),core:Object.keys(CORE).map(function(k){return {name:k,path:CORE[k],value:read(G,CORE[k])};}),classes:list(G.classes).map(function(c){return {id:c.id,name:c.name,satisfaction:c.satisfaction,influence:c.influence};}),parties:list(G.parties).map(function(p){return {id:p.id,name:p.name,influence:p.influence,cohesion:p.cohesion,status:p.status};})};}
  TM.EdictEffects={begin:begin,finish:finish,fail:fail,cancel:function(G){sessions.delete(G);},applyAuxiliary:applyAuxiliary,applyNumeric:applyNumeric,route:route,recordApplied:recordApplied,partyNumeric:partyNumeric,entity:entity,normalizePath:norm,read:read,descriptors:descriptors,catalog:catalog};
})(typeof window!=='undefined'?window:globalThis);
