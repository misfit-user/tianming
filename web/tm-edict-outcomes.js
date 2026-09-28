/* Player edict registration and turn receipts. World effects stay in the existing domain writers. */
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  var CATS = { political:'政令', military:'军令', diplomatic:'外交', economic:'经济', other:'其他', decree:'诏书' };
  var OPEN = { pending:1, executing:1, partial:1, obstructed:1, pending_delivery:1 };
  var LABELS = { pending:'待回报', executing:'执行中', completed:'已办结', partial:'部分执行', obstructed:'执行受阻', pending_delivery:'传递途中', failed:'未能执行', cancelled:'已撤回' };
  function list(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function copy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function hash(s) { var h=2166136261; for(var i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36); }
  function rows(edicts) {
    if (Array.isArray(edicts)) return edicts.map(function(e){return typeof e==='string'?{content:e,category:'诏令'}:e;}).filter(Boolean);
    if (edicts && Array.isArray(edicts.list)) return rows(edicts.list);
    return Object.keys(CATS).map(function(k){return {content:str(edicts&&edicts[k]),category:CATS[k],sourceKey:k};}).filter(function(e){return e.content;});
  }
  function submitted(e,turn) { return e && (e.turn===turn || e.lastSubmittedTurn===turn); }
  function collect(G,edicts,turn) {
    if(!G)return [];
    turn=turn==null?Number(G.turn)||0:Number(turn);
    if(!Array.isArray(G._edictTracker))G._edictTracker=[];
    var input=rows(edicts),out=[];
    input.forEach(function(e){
      var content=str(e.content||e.text);if(!content)return;
      var published=e.sourceKey==='decree'?list(G.edicts).filter(function(p){return p&&p.turn===turn&&p.status==='promulgated'&&str(p.text)&&content.indexOf(str(p.text))>=0;}):[];
      var entries=published.length?published.map(function(p){return {content:str(p.text),category:'诏书',id:p.id};}):[{content:content,category:e.category||'诏令',id:e.id}];
      entries.forEach(function(item){
        var existing=G._edictTracker.filter(function(t){return t&&((item.id&&t.id===item.id)||(t.content===item.content&&(submitted(t,turn)||OPEN[t.status])));});
        var t=existing.length===1?existing[0]:null;
        if(!t){
          var id=item.id||'edict-'+turn+'-'+hash((item.category||'')+'\n'+item.content),n=1,base=id;
          while(G._edictTracker.some(function(x){return x&&x.id===id;}))id=base+'-'+n++;
          t={id:id,content:item.content,category:item.category,turn:turn,status:'pending',assignee:'',feedback:'',progressPercent:0};
          G._edictTracker.push(t);
        }
        if(!t.id)t.id='edict-'+t.turn+'-'+hash(t.category+'\n'+t.content);
        t.lastSubmittedTurn=turn;
        if(out.indexOf(t)<0)out.push(t);
      });
    });
    return out;
  }
  function match(G,feedback,turn) {
    if(!feedback)return null;
    var id=str(feedback.edictId||feedback.sourceEdictId),all=list(G&&G._edictTracker);
    if(id)return all.find(function(t){return t&&t.id===id;})||null;
    var text=str(feedback.content),found=text?all.filter(function(t){return t&&str(t.content)===text&&(submitted(t,turn)||OPEN[t.status]);}):[];
    return found.length===1?found[0]:null;
  }
  function coverage(G,edicts,output,turn) {
    turn=turn==null?Number(G.turn)||0:turn;
    var inputs=rows(edicts),required=list(G._edictTracker).filter(function(t){return t&&Number(t.turn||0)<=turn&&!(TM.EdictEfficacy&&TM.EdictEfficacy.isSystemOneOff(t))&&(OPEN[t.status]||submitted(t,turn)&&inputs.some(function(e){return str(e.content||e.text).indexOf(t.content)>=0;}));}),seen={},unmatched=[];
    required.forEach(function(t){if(list(t.outcomes).some(function(r){return r.turn===turn&&r.coverage==='reported';}))seen[t.id]=true;});
    list(output&&output.edict_feedback).forEach(function(f){var t=match(G,f,turn);if(t&&str(f.feedback))seen[t.id]=true;else unmatched.push(copy(f));});
    return {turn:turn,required:required,missing:required.filter(function(t){return !seen[t.id];}),unmatched:unmatched};
  }
  function inputPrompt(G,edicts,turn) {
    var required=collect(G,edicts,turn),active=list(G._edictTracker).filter(function(t){return t&&OPEN[t.status]&&required.indexOf(t)<0;});
    if(!required.length&&!active.length)return '';
    return '\n【诏令编号与落地回报】\n'+required.concat(active).map(function(t){return JSON.stringify({edictId:t.id,content:t.content,category:t.category,status:t.status,submitted:submitted(t,turn),lastFeedback:t.feedback||''});}).join('\n')+
      (TM.EdictEffects?'\n【本剧本现有数据定义】\n'+JSON.stringify(TM.EdictEffects.catalog(G))+'\n只改变确有因果影响的对象。核心指标使用其实际路径；钱粮走财政字段；其他变量遵守范围、单位和派生关系。阶层使用 class_changes；党派使用 party_changes（influence_delta/cohesion_delta）或正式 party_updates。不得另造同名变量来替代实际机制。\n':'')+
      '\n本回合提交的每道诏令须有 edict_feedback；整道诏书的各项要求用 clauses 分别交代，保持一份原文。每项填写 clauseId、content、status、feedback、effectRefs。反馈填写 edictId、assignee、status、feedback、nextStep、effectRefs。effectRefs 引用本响应实际执行字段，如 changes[0]、fiscal_adjustments[0]、class_changes[0]、party_changes[0]；不要在反馈中另写一份数值变化。相关操作也带 edictId；同一效果只在一个权威字段输出。给定 ID 不得改写。无即时变化说明原因、阻力和下一步，不得把漏回报编为已经执行。完成涉及数据的事项必须有可核验的实际操作。\n';
  }
  function mergeSupplement(base,extra,allowedIds) {
    if(!extra||typeof extra!=='object')return base;
    var allowed=['changes','fiscal_adjustments','currency_adjustments','population_adjustments','central_local_actions','institution_changes','char_updates','office_assignments','personnel_changes','class_changes','party_changes','party_relation_changes','army_changes','tax_reforms','building_changes','edict_lifecycle_update'],offsets={};
    allowedIds=list(allowedIds);var remap={};
    allowed.forEach(function(k){offsets[k]=list(base[k]).length;list(extra[k]).forEach(function(op,i){if(!op||allowedIds.length&&allowedIds.indexOf(op.edictId)<0)return;var target=list(base[k]);remap[k+'['+i+']']=k+'['+target.length+']';base[k]=target.concat([copy(op)]);});});
    function shift(ref){return remap[String(ref)]||null;}
    list(extra.edict_feedback).forEach(function(f){if(!f||allowedIds.length&&allowedIds.indexOf(f.edictId)<0)return;var row=copy(f);row.effectRefs=list(row.effectRefs).map(shift).filter(Boolean);list(row.clauses).forEach(function(c){c.effectRefs=list(c.effectRefs).map(shift).filter(Boolean);});base.edict_feedback=list(base.edict_feedback).concat([row]);});
    return base;
  }
  function record(G,t,entry) {
    if(!Array.isArray(t.outcomes))t.outcomes=[];
    var i=t.outcomes.findIndex(function(r){return r.turn===entry.turn;});
    if(i<0)t.outcomes.push(copy(entry));else t.outcomes[i]=copy(entry);
    if(t.outcomes.length>24)t.outcomes=t.outcomes.slice(-24);
  }
  function receive(G,output,edicts,turn,effects) {
    turn=turn==null?Number(G.turn)||0:turn;
    var check=coverage(G,edicts,output,turn),seen={},unknown=check.unmatched;
    list(output&&output.edict_feedback).forEach(function(raw){
      var t=match(G,raw,turn);if(!t||!str(raw.feedback)||seen[t.id])return;
      seen[t.id]=true;
      var f=copy(raw);
      if(TM.ImperialOrders)f=TM.ImperialOrders.guardEdict(G,Object.assign({},f,{edictId:t.id}));
      var status=LABELS[f.status]?f.status:'executing',progress=Number(f.progressPercent);
      var inTransit=list(t._letterIds).some(function(id){var l=list(G.letters).find(function(x){return x.id===id;});return !l||['delivered','returned','replying'].indexOf(l.status)<0;});
      if(inTransit){status='pending_delivery';progress=0;}
      var actual=list(effects).filter(function(e){return list(e.edictIds).indexOf(t.id)>=0;});
      var previous=list(t.outcomes).find(function(r){return r.turn===turn;});
      if(!actual.length&&previous)actual=copy(previous.effects||[]);
      var unverified=actual.some(function(e){return e.status==='unverified';}),limited=actual.some(function(e){return e.status==='blocked'||e.status==='partial';}),unresolved=unverified||limited;
      var note=inTransit?'信使尚在途中，执行结果须待送达后核实。':unverified?'部分效果尚未核实，请见对应事项。':limited?'部分事项受阻或仅部分落实，请见实际执行记录。':status==='completed'&&!actual.length?'报称办结，尚无可核验的落地记录。':'';
      if(status==='completed'&&unresolved)status='partial';
      if(raw.status==='completed'&&status!=='completed'&&!inTransit){var payments=actual.filter(function(e){return e.shortfall&&Number(e.requested)>0;});progress=payments.length===actual.length&&payments.length?Math.round(payments.reduce(function(n,e){return n+Math.abs(e.after-e.before);},0)/payments.reduce(function(n,e){return n+Number(e.requested);},0)*100):previous&&Number(previous.progressPercent)<100?Number(previous.progressPercent):0;}
      t.status=status;t.assignee=str(f.assignee)||t.assignee||'';t.feedback=str(f.feedback);
      t.progressPercent=isFinite(progress)?Math.max(0,Math.min(100,progress)):(status==='completed'?100:0);
      if(inTransit)t.feedback=note;
      if(TM.EdictEfficacy)TM.EdictEfficacy.judge(G,t,f);
      var clauses=copy(list(f.clauses));clauses.forEach(function(c){var linked=actual.filter(function(e){return list(c.effectRefs).indexOf(e.ref)>=0;});if(c.status==='completed'&&linked.some(function(e){return ['blocked','partial','unverified'].indexOf(e.status)>=0;})){c.reportedStatus=c.status;c.status='partial';c.note='此项尚未全部落实，请见实际执行记录。';}});
      record(G,t,{turn:turn,edictId:t.id,content:t.content,category:t.category,status:status,reportedStatus:raw.status,assignee:t.assignee,feedback:t.feedback,progressPercent:t.progressPercent,nextStep:str(f.nextStep),note:note,clauses:clauses,effects:actual,coverage:'reported'});
      if(!t._reliefCaseId&&(!previous||previous.coverage!=='reported')&&typeof root.addEB==='function'&&['completed','partial','obstructed'].indexOf(status)>=0)root.addEB({completed:'诏令功成',partial:'诏令部行',obstructed:'诏令受阻'}[status],(t.category||'诏令')+'：'+t.content.slice(0,40)+' — '+(note||t.feedback));
    });
    check.missing.forEach(function(t){record(G,t,{turn:turn,edictId:t.id,content:t.content,category:t.category,status:'pending',assignee:t.assignee||'',feedback:'尚未获得本回合的执行回报。',nextStep:'待补正执行情况。',effects:list(effects).filter(function(e){return list(e.edictIds).indexOf(t.id)>=0;}),coverage:'missing'});});
    if(unknown.length&&check.required.length){var t=check.required[0],r=list(t.outcomes).find(function(x){return x.turn===turn;});if(r)r.unmatched=unknown.map(function(f){return {edictId:str(f&&f.edictId),content:str(f&&f.content),feedback:str(f&&f.feedback)};});}
    return forTurn(G,turn);
  }
  function forTurn(G,turn) {
    var out=[];list(G&&G._edictTracker).forEach(function(t){list(t&&t.outcomes).forEach(function(r){if(r.turn===turn)out.push(copy(r));});});return out;
  }
  function toolStart(G,name,input,turn) {
    if(!input.edictId)return null;
    var t=match(G,input,turn);if(!t)return {blocked:true,reason:'诏令编号不存在'};
    if(list(t._letterIds).some(function(id){var l=list(G.letters).find(function(x){return x.id===id;});return !l||['delivered','returned','replying'].indexOf(l.status)<0;}))return {blocked:true,reason:'信使尚未送达'};
    var key='agent:'+name+':'+(input.effectId||hash(JSON.stringify(input)));
    var old=list(t.outcomes).find(function(r){return r.turn===turn;}),duplicate=list(old&&old.effects).find(function(e){return e.key===key&&(e.status==='applied'||e.status==='unchanged'||e.status==='recorded');});
    if(duplicate)return {duplicate:true,receipt:duplicate};
    var path=input.path||(name==='adjust_treasury'?(input.account||'guoku')+'.'+(input.currency||'money'):'');
    if(TM.EdictEffects)path=TM.EdictEffects.normalizePath(path,G);
    return {tracker:t,key:key,turn:turn,path:path,before:path&&TM.EdictEffects?TM.EdictEffects.read(G,path):null};
  }
  function toolFinish(G,token,name,input,result) {
    if(!token||token.blocked||token.duplicate)return;
    var t=token.tracker,row=list(t.outcomes).find(function(r){return r.turn===token.turn;});
    if(!row)row={turn:token.turn,edictId:t.id,content:t.content,category:t.category,status:'pending',feedback:'已收到执行记录，承办回报尚待补齐。',coverage:'missing',effects:[]};
    row=copy(row);row.effects=list(row.effects);
    var after=token.path&&TM.EdictEffects?TM.EdictEffects.read(G,token.path):null;
    var r={ref:token.key,key:token.key,edictIds:[t.id],path:token.path,label:token.path||name,before:token.before,after:after,status:result&&result.ok?(result.deferred?'unverified':token.path?(JSON.stringify(after)===JSON.stringify(token.before)?'unchanged':'applied'):'recorded'):'blocked',note:result&&result.reason||'',visibility:/^(minxin|corruption)\./.test(token.path)?'reported':'public'};
    row.effects=row.effects.filter(function(e){return e.key!==token.key;}).concat([r]);record(G,t,row);return copy(r);
  }
  function agentReport(G,input,turn) {
    var t=match(G,input,turn);if(!t)return {ok:false,reason:'诏令编号不存在'};
    if(!str(input.feedback)||!LABELS[input.status])return {ok:false,reason:'须给出有效执行状态与具体回报'};
    receive(G,{edict_feedback:[input]},[],turn,[]);
    return {ok:true,changed:false,verified:true,path:'_edictTracker.'+t.id+'.outcomes',new:t.status};
  }
  function narrativeFacts(G,turn) {
    return '\n【诏令实际执行回执·成文依据】\n'+JSON.stringify(forTurn(G,turn))+
      '\n实录按时序凝练纪事；时政记写传达、执行者、过程、阻力、效果与后续，标注奏报/探报/传闻来源；后人戏说把同一过程化为人物生活、动作、对话及情境。实际落账值约束已确认事实，奏报与传闻可以不符但须保留来源和不确定性，不向玩家直接揭露未知真相。没有回执不等于没有效果；未核实、未送达、未落账不能写成已经完成。叙事不得再次触发已结算效果。\n';
  }
  function finalizeTurn(G,turn){
    if(!TM.EdictEffects)return;
    list(G._edictTracker).forEach(function(t){list(t.outcomes).forEach(function(r){if(r.turn!==turn)return;list(r.effects).forEach(function(e){if(!e.path)return;e.finalValue=TM.EdictEffects.read(G,e.path);});});});
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function feedbackHtml(reports,turn) {
    if(!list(reports).length)return '';
    var html='<div class="tr-section"><div class="tr-section-hdr"><span class="lab">诏 令 回 报</span><span class="meta">本回合 '+reports.length+' 道</span></div>';
    reports.forEach(function(r){
      html+='<div class="sjc-ef-report"><div class="sjc-ef-report-hd"><span class="st">'+esc(LABELS[r.status]||'待核')+' · '+esc(r.category||'诏令')+'</span></div><div class="sjc-ef-content">'+esc(r.content)+'</div><p>'+esc(r.assignee?('承办：'+r.assignee+'。'):'')+'回报：'+esc(r.feedback)+'</p>';
      list(r.clauses).forEach(function(c){html+='<p>'+esc(c.content)+'【'+esc(LABELS[c.status]||'待回报')+'】：'+esc(c.feedback||'')+esc(c.note?'（'+c.note+'）':'')+'</p>';});
      list(r.effects).forEach(function(e){
        // Hidden truth is supplied only to simulation; player feedback obeys the effect's disclosure.
        if(e.visibility==='hidden')return;
        var value= ['applied','unchanged','partial'].indexOf(e.status)>=0 ? (e.visibility==='reported'?'已记入相关账目':JSON.stringify(e.before)+' → '+JSON.stringify(e.after)) : (e.note||'尚未取得落地回执');
        if(e.shortfall)value+='；'+e.note;
        var finalNote=e.visibility!=='reported'&&e.finalValue!==undefined&&JSON.stringify(e.finalValue)!==JSON.stringify(e.after)?'；回合结束时记录为 '+JSON.stringify(e.finalValue):'';
        html+='<p>'+esc(e.label||e.path||e.ref)+'：'+esc(value)+(e.shared?'（共同作用）':'')+esc(finalNote)+'</p>';
      });
      if(r.note)html+='<p>'+esc(r.note)+'</p>';
      if(r.nextStep)html+='<p>后续：'+esc(r.nextStep)+'</p>';
      if(list(r.unmatched).length)html+='<p>另有 '+r.unmatched.length+' 条回报尚未对上诏令，待核。</p>';
      html+='</div>';
    });return html+'</div>';
  }
  function auditLease(G,turn) {return {game:G,turn:turn,campaign:G._campaignId||'',timeline:G._timelineId||'',generation:root._tmLoadGen||0};}
  function leaseCurrent(l) {return !!l&&root.GM===l.game&&(root._tmLoadGen||0)===l.generation&&(l.game._campaignId||'')===l.campaign&&(l.game._timelineId||'')===l.timeline;}
  function publishAudit(lease,report) {
    if(!leaseCurrent(lease))return false;
    var G=lease.game;report.turn=lease.turn;
    var previous=G._edictEfficacyReport;
    if(!previous||Number(previous.turn)<=lease.turn)G._edictEfficacyReport=copy(report);
    var row=list(G.shijiHistory).find(function(r){return r.turn===lease.turn;});
    if(row){
      row.edictAudit=copy(report);
      if(typeof root._renderEdictAudit==='function'){
        var html=root._renderEdictAudit(report,lease.turn),mark='<!--edict-audit:'+lease.turn+':';
        var start=row.html&&row.html.indexOf(mark+'start-->'),end=row.html&&row.html.indexOf(mark+'end-->');
        if(start>=0&&end>start)row.html=row.html.slice(0,start)+mark+'start-->'+html+row.html.slice(end);
        if(root.document&&root.document.querySelectorAll)list(Array.from(root.document.querySelectorAll('[data-edict-audit-turn="'+lease.turn+'"]'))).forEach(function(el){el.innerHTML=html;});
      }
      if(typeof root.requestBackgroundAutosave==='function')root.requestBackgroundAutosave({reason:'edict-audit'});
    }
    return true;
  }
  TM.EdictOutcomes={collect:collect,rows:rows,match:match,coverage:coverage,inputPrompt:inputPrompt,mergeSupplement:mergeSupplement,receive:receive,forTurn:forTurn,finalizeTurn:finalizeTurn,narrativeFacts:narrativeFacts,feedbackHtml:feedbackHtml,auditLease:auditLease,leaseCurrent:leaseCurrent,publishAudit:publishAudit,toolStart:toolStart,toolFinish:toolFinish,agentReport:agentReport};
})(typeof window!=='undefined'?window:globalThis);
