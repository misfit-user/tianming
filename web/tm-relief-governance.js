// @ts-check
// Cash-relief pilot: currentIssues owns the case; transferOrders owns paid money
// in transit. AI adjudicates execution, never authorizes extra money or identities.
(function(global) {
  'use strict';
  var TM = global.TM = global.TM || {};
  var TERMINAL = { completed: true, cancelled: true };
  var LABELS = { awaiting_funding: '待筹款', executing: '承办中', blocked: '待处置', completed: '已结案', cancelled: '已撤止' };
  function fail(code, reason) { return { ok: false, code: code, reason: reason || code }; }
  function text(v, limit) { return typeof v === 'string' ? v.trim().slice(0, limit || 400) : ''; }
  function number(v, positive) { return typeof v === 'number' && Number.isFinite(v) && v <= Number.MAX_SAFE_INTEGER && (positive ? v > 0 : v >= 0); }
  function cash(v) { return Math.round(v*100)/100; }
  function cashValue(v,positive) { return number(v,positive) && Number.isSafeInteger(Math.round(v*100)) && Math.abs(v-cash(v))<1e-9; }
  function copy(v, seen) {
    if (v === null || typeof v !== 'object') return v;
    seen = seen || new Map(); if (seen.has(v)) return seen.get(v);
    var out = Array.isArray(v) ? [] : {}; seen.set(v, out);
    Object.keys(v).forEach(function(k) {
      var d = Object.getOwnPropertyDescriptor(v, k);
      if (!d || !('value' in d)) throw new Error('relief-state-accessor');
      Object.defineProperty(out,k,{ value:copy(d.value,seen), writable:true, configurable:true, enumerable:true });
    });
    return out;
  }
  function enabled(G) { return !!(G && G._reliefPilot && G._reliefPilot.version === 1 && G._reliefPilot.enabled === true); }
  function cases(G) { return ((G && G.currentIssues) || []).filter(function(i) { return i && i.relief && i.relief.version === 1; }); }
  function find(G,id) { var hits=cases(G).filter(function(i){return i.id===id;});return hits.length===1?hits[0]:null; }
  function current(G) { return !!G && G === global.GM; }
  function busy() { return typeof global.isWorldTransactionActive==='function' && global.isWorldTransactionActive(); }
  function regions(G) {
    var out=[], seen=new Set();
    function walk(rows) { (Array.isArray(rows)?rows:[]).forEach(function(r) {
      if(!r || typeof r!=='object' || seen.has(r))return; seen.add(r);
      var kids=r.children || r.divisions || r.subs;
      if(Array.isArray(kids) && kids.length)walk(kids); else if(r.id)out.push(r);
    }); }
    var ah=G && G.adminHierarchy;
    if(ah && global.IntegrationBridge && typeof global.IntegrationBridge.getLeafDivisions==='function') {
      return global.IntegrationBridge.getLeafDivisions(ah,'player').filter(function(r){return r && r.id;});
    }
    if(ah) { if(Array.isArray(ah.divisions))walk(ah.divisions); else Object.keys(ah).forEach(function(k){var f=ah[k];if(f)walk(f.divisions || f.children || f.subs);}); }
    // Prefer the authoritative administrative leaves, not a second map mirror.
    if(!out.length)walk(G && G.regions);
    return out;
  }
  function exact(rows,id) { var matches=rows.filter(function(r){return r && r.id===id;}); return matches.length===1?matches[0]:null; }
  function officer(G,id) { var c=exact(G.chars || [],id); return c && !c.dead && !c.deceased && !c.retired && c.alive!==false ? c : null; }
  function orderFor(G,id) { return (G.transferOrders || []).filter(function(o){return o && o.reliefCaseId===id;}); }
  function totals(G,id) {
    return orderFor(G,id).reduce(function(t,o){
      if(!cashValue(o.amount,false)||!cashValue(o.deliveredAmount,false)||!cashValue(o.refundedAmount,false)||cash(o.deliveredAmount+o.refundedAmount)>o.amount)throw new Error('relief-order-invalid');
      t.funded=cash(t.funded+o.amount); t.disbursed=cash(t.disbursed+o.deliveredAmount); t.refunded=cash(t.refunded+o.refundedAmount); return t;
    },{funded:0,disbursed:0,refunded:0});
  }
  function view(G,id) {
    var i=find(G,id); if(!i)return null;
    var r=copy(i.relief), t=totals(G,id);
    return Object.assign(r,t,{issueId:id,title:i.title,edictId:r.edictId,statusLabel:LABELS[r.status],
      remaining:cash(t.funded-t.disbursed-t.refunded),unfunded:cash(r.budget-t.funded),overdue:r.elapsedDays>r.deadlineDays&&!TERMINAL[r.status],
      orders:copy(orderFor(G,id)),history:copy(r.history || [])});
  }
  function edit(target,key,value) { return {target:target,key:key,value:value}; }
  // All descriptors are checked before publishing anything. Existing setters are
  // never invoked. Restore exact descriptors if a later defineProperty fails.
  function publish(edits) {
    var done=[];
    edits.forEach(function(e){
      var d=Object.getOwnPropertyDescriptor(e.target,e.key);
      if(d && (!('value' in d) || !d.writable))throw new Error('relief-state-readonly:'+e.key);
      if(!d && !Object.isExtensible(e.target))throw new Error('relief-state-not-extensible');
    });
    try {
      edits.forEach(function(e){
        var d=Object.getOwnPropertyDescriptor(e.target,e.key);
        done.push({target:e.target,key:e.key,descriptor:d});
        Object.defineProperty(e.target,e.key,Object.assign({},d || {enumerable:true,configurable:true,writable:true},{value:e.value}));
      });
    } catch(error) {
      done.reverse().forEach(function(e){if(e.descriptor)Object.defineProperty(e.target,e.key,e.descriptor);else delete e.target[e.key];});
      throw error;
    }
  }
  function append(r,kind,detail,G) {
    r.history.push({turn:G.turn || 0,day:r.elapsedDays,kind:kind,detail:text(detail,400)});
    if(r.history.length>60)r.history.splice(0,r.history.length-60);
  }
  function changedEdits(G,issue,r,orders) {
    var next=Object.assign({},issue,{relief:r,description:r.text+'\n'+(LABELS[r.status]||r.status)+'：'+(r.lastReason||'等待筹款与承办。'),
      status:TERMINAL[r.status]?'resolved':'pending',linkedChars:[r.assigneeName]});
    if(TERMINAL[r.status])next.resolvedTurn=G.turn || 0;
    if(r.consequence)next.longTermConsequences={后续关注:r.consequence};
    var edits=[edit(G,'currentIssues',G.currentIssues.map(function(i){return i===issue?next:i;}))]; // arch-ok ReliefGovernance owns only explicitly tagged currentIssues cases.
    var tracker=(G._edictTracker || []).map(function(e){
      if(e.id!==r.edictId || e._reliefCaseId!==issue.id)return e;
      return Object.assign({},e,{assignee:r.assigneeName,feedback:r.lastReason||LABELS[r.status],
        status:TERMINAL[r.status]?'executed':'executing',progressPercent:r.status==='completed'?100:0});
    });
    edits.push(edit(G,'_edictTracker',tracker)); // arch-ok Mirror only the stable linked relief edict; no unrelated entry mutation.
    if(orders)edits.push(edit(G,'transferOrders',orders)); // arch-ok Only explicitly tagged pilot orders are changed by their owner.
    return edits;
  }
  function safe(fn) { try{return fn();}catch(e){
    try{if(TM.errors && TM.errors.capture)TM.errors.capture(e,'relief-governance');}catch(_){/* diagnostic failure must not hide operation failure */}
    return fail('relief-transaction-failed','办理未提交：'+String(e && e.message || e));
  } }
  function setEnabled(G,on) { return safe(function(){
    if(!current(G))return fail('stale-world');
    if(busy())return fail('world-transaction-active','正在过回合或读档，请完成后再办理。');
    if(!on && cases(G).some(function(i){return !TERMINAL[i.relief.status];}))return fail('relief-active-cases','仍有在办赈务；请先结案或撤止，不能遗留在途资金。');
    if(G._reliefPilot && G._reliefPilot.version!==1)return fail('relief-version-unsupported');
    publish([edit(G,'_reliefPilot',{version:1,enabled:!!on,sequence:G._reliefPilot && G._reliefPilot.sequence || 0})]); // arch-ok World-local relief opt-in and sequence, owned here.
    return {ok:true,enabled:!!on};
  }); }
  function create(G,spec) { return safe(function(){
    if(!current(G)||!enabled(G))return fail('relief-disabled','请先启用本局赈务试点。');
    if(busy())return fail('world-transaction-active','正在过回合或读档，请完成后再立案。');
    spec=spec || {}; var region=exact(regions(G),spec.regionId), ch=officer(G,spec.assigneeId);
    if(!region)return fail('relief-region-invalid','灾地必须绑定唯一的现有行政地区 ID。');
    if(!ch)return fail('relief-officer-invalid','承办人必须绑定唯一的在世人物 ID。');
    if(!text(spec.text,2000)||!text(spec.requestId,100)||!cashValue(spec.amount,true)||!number(spec.deadlineDays,true)||spec.deadlineDays>3650)return fail('relief-plan-invalid','请填写旨意、最多两位小数的正数预算和有效期限。');
    if(['guoku','neitang','local'].indexOf(spec.source)<0)return fail('relief-source-invalid');
    var fingerprint=JSON.stringify([spec.text,spec.regionId,spec.assigneeId,spec.amount,spec.source,spec.deadlineDays]);
    var duplicate=cases(G).find(function(i){return i.relief.requestId===spec.requestId;});
    if(duplicate)return duplicate.relief.fingerprint===fingerprint?{ok:true,duplicate:true,issueId:duplicate.id}:fail('relief-request-conflict');
    var seq=(G._reliefPilot.sequence||0)+1, id='relief-'+(G.turn||0)+'-'+seq, eid=id+'-edict';
    if(!Number.isSafeInteger(seq)||seq<1)return fail('relief-sequence-invalid','赈务序号损坏，未建立新案。');
    if((G.currentIssues||[]).some(function(i){return i&&i.id===id;})||(G._edictTracker||[]).some(function(e){return e&&e.id===eid;}))return fail('relief-id-conflict','案号与已有记录冲突，原记录未修改。');
    var r={version:1,requestId:spec.requestId,fingerprint:fingerprint,edictId:eid,text:text(spec.text,2000),
      regionId:region.id,regionName:region.name || region.id,assigneeId:ch.id,assigneeName:ch.name || ch.id,
      budget:spec.amount,source:spec.source,deadlineDays:spec.deadlineDays,elapsedDays:0,lastTickTurn:G.turn||0,
      createdTurn:G.turn||0,revision:1,status:'awaiting_funding',history:[],requests:[],lastAssessedTurn:null,rewardApplied:0,penaltyApplied:0};
    append(r,'立案','已批准预算，尚未扣款；等待筹款。',G);
    var issue={id:id,title:'赈务·'+r.regionName,category:'赈济',affectedRegion:r.regionName,raisedTurn:G.turn||0,status:'pending',
      description:r.text,linkedChars:[r.assigneeName],choices:[],relief:r};
    publish([edit(G,'_reliefPilot',{version:1,enabled:true,sequence:seq}),
      edit(G,'currentIssues',(G.currentIssues||[]).concat([issue])),
      edit(G,'_edictTracker',(G._edictTracker||[]).concat([{id:eid,content:r.text,category:'赈济',turn:G.turn||0,status:'executing',
        assignee:r.assigneeName,feedback:'已立案，尚未拨付',progressPercent:0,_reliefCaseId:id}]))]); // arch-ok Atomic registration of the case and its sole linked edict.
    return {ok:true,issueId:id,revision:1};
  }); }
  function payment(G,r,amount,credit,metadata) {
    if(!global.FiscalEngine || typeof global.FiscalEngine.commitReliefPayment!=='function')return fail('relief-fiscal-unavailable','财政办理接口未就绪，未发生扣款。');
    return global.FiscalEngine.commitReliefPayment({gameRef:G,source:r.source,regionId:r.regionId,amount:amount,credit:!!credit,
      tag:'赈务·'+r.edictId},function(edits,receipt){publish(metadata(receipt).concat(edits));return {ok:true,receipt:receipt};});
  }
  function available(G,r) {
    if(!global.FiscalEngine || typeof global.FiscalEngine.reliefBalance!=='function')return null;
    return global.FiscalEngine.reliefBalance({gameRef:G,source:r.source,regionId:r.regionId});
  }
  function act(G,id,spec) { return safe(function(){
    if(!current(G)||!enabled(G))return fail('stale-world');
    if(busy())return fail('world-transaction-active','正在过回合或读档，请完成后再办理。');
    var issue=find(G,id); if(!issue)return fail('relief-not-found'); spec=spec||{};
    var previous=issue.relief.requests.find(function(q){return q.id===spec.requestId;});
    var signature=JSON.stringify([spec.action,spec.amount,spec.allowPartial,spec.assigneeId,spec.extraDays]);
    if(previous)return previous.signature===signature?{ok:true,duplicate:true,issueId:id}:fail('relief-request-conflict');
    if(!text(spec.requestId,100)||spec.expectedRevision!==issue.relief.revision)return fail('relief-stale-revision','案卷已更新，请查看最新记录后再办理。');
    if(TERMINAL[issue.relief.status])return fail('relief-terminal');
    var r=copy(issue.relief), t=totals(G,id), orders=copy(G.transferOrders || []), amount=0, credit=false;
    if(spec.action==='fund') {
      if(!cashValue(spec.amount,true)||spec.amount>cash(r.budget-t.funded))return fail('relief-budget-exceeded','筹款须至多两位小数，且不得超过未拨预算。');
      var balance=available(G,r); if(!balance || balance.ok!==true)return balance || fail('relief-fiscal-unavailable');
      amount=spec.allowPartial===true?Math.min(spec.amount,Math.floor((balance.available+1e-9)*100)/100):spec.amount;
      if(amount<=0||amount>balance.available+1e-9)return fail('relief-insufficient-funds','实际可用钱款不足；未扣款。');
      r.status='executing'; r.lastReason='已筹款，待承办执行；尚未记作灾民收讫。';
    } else if(spec.action==='reassign') {
      var ch=officer(G,spec.assigneeId); if(!ch)return fail('relief-officer-invalid');
      r.assigneeId=ch.id;r.assigneeName=ch.name || ch.id;r.lastReason='改由'+r.assigneeName+'接办；既有拨付与发放记录保留。';
    } else if(spec.action==='extend') {
      if(!number(spec.extraDays,true)||spec.extraDays>365)return fail('relief-deadline-invalid');
      r.deadlineDays+=spec.extraDays;r.lastReason='展期'+spec.extraDays+'日；不重置已过日期。';
    } else if(spec.action==='resize') {
      if(!cashValue(spec.amount,true)||spec.amount<t.funded)return fail('relief-budget-below-funded','修订预算须至多两位小数且不低于已筹款；撤止时只退未发放余额。');
      r.budget=spec.amount;r.lastReason='预算修订为 '+spec.amount+'；既有收支记录不变。';
    } else if(spec.action==='investigate') {
      r.investigationRequested=true;r.lastReason='已要求核对呈报与发放记录；尚无独立核查结论。';
    } else if(spec.action==='resume') {
      r.status=t.funded>t.disbursed+t.refunded?'executing':'awaiting_funding';r.lastReason='已催办，等待下一次执行推演。';
    } else if(spec.action==='cancel') {
      amount=cash(t.funded-t.disbursed-t.refunded);credit=true;r.status='cancelled';r.lastReason='撤止未办部分；已经发放的钱款不退回。';
      orders.forEach(function(o){if(o.reliefCaseId===id){o.refundedAmount=cash(o.amount-o.deliveredAmount);o.status='cancelled';}});
    } else return fail('relief-action-invalid');
    r.revision++;r.requests.push({id:spec.requestId,signature:signature});
    // Older replays still carry an obsolete expectedRevision and fail closed.
    if(r.requests.length>64)r.requests.splice(0,r.requests.length-64);
    append(r,spec.action,r.lastReason,G);
    function metadata(receipt) {
      if(credit&&receipt)r.refundReceipt=receipt;
      if(spec.action==='fund')orders.push({id:id+'-pay-'+r.revision,reliefCaseId:id,protocol:'relief-cash-v1',
        fromAccount:r.source,toRegion:r.regionId,amount:amount,deliveredAmount:0,refundedAmount:0,status:'relief-held',
        createTurn:G.turn||0,receipt:receipt});
      return changedEdits(G,issue,r,orders);
    }
    if(amount>0)return payment(G,r,amount,credit,metadata);
    publish(metadata(null));return {ok:true,issueId:id,revision:r.revision};
  }); }
  function tick(G,opts) { return safe(function(){
    if(!current(G)||!enabled(G))return {ok:true,updated:0};opts=opts||{};
    if(!number(opts.days,true)||!Number.isInteger(opts.turn)||opts.turn!==G.turn)return fail('relief-clock-invalid');
    var count=0, issues=(G.currentIssues||[]).map(function(i){
      if(!i.relief||i.relief.version!==1||TERMINAL[i.relief.status]||opts.turn<=i.relief.lastTickTurn)return i;
      var r=copy(i.relief);r.elapsedDays+=opts.days;r.lastTickTurn=opts.turn;r.revision++;count++;
      return Object.assign({},i,{relief:r});
    });
    if(count)publish([edit(G,'currentIssues',issues)]); // arch-ok Advance only the explicit pilot cases; deadlines do not settle outcomes.
    return {ok:true,updated:count};
  }); }
  function capture(G,id) {
    var v=view(G,id); if(!v)return null;
    return {gm:G,p:global.P,loadGen:global._tmLoadGen||0,campaign:G._campaignId||'',timeline:G._timelineId||'',
      turn:G.turn||0,issueId:id,revision:v.revision,view:v,
      lease:typeof global._tmCaptureWorldLease==='function'?global._tmCaptureWorldLease():null};
  }
  function leaseCurrent(G,s) {
    return s && current(G) && s.gm===G && s.p===global.P && s.loadGen===(global._tmLoadGen||0) &&
      s.campaign===(G._campaignId||'') && s.timeline===(G._timelineId||'') && s.turn===(G.turn||0) &&
      (!s.lease || typeof global._tmWorldLeaseCurrent==='function' && global._tmWorldLeaseCurrent(s.lease));
  }
  function settlementEdits(G,id,r,delta) {
    if(!TM.MinxinLedger || typeof TM.MinxinLedger.recordAndApply!=='function')throw new Error('relief-minxin-unavailable');
    // Stage the actual owner on a detached, alias-preserving affected state graph.
    // No whole-world history/AI archive clone and no mutation of live GM/P.
    var keys=['minxin','_minxinLedger','adminHierarchy','regions','classes'], bundle={};
    keys.forEach(function(k){if(G[k]!==undefined)bundle[k]=G[k];});
    var staged=Object.assign({},G,copy(bundle));
    var target=exact(regions(staged),r.regionId);
    if(!target||!number(target.minxin!=null?target.minxin:target.minxinLocal,false))throw new Error('relief-minxin-target-invalid');
    var leafBefore=regions(staged).map(function(div){return{div:div,value:div.minxin!=null?div.minxin:div.minxinLocal};});
    var settlementId=id+'-settlement-'+r.revision;
    var result=TM.MinxinLedger.recordAndApply(staged,{id:settlementId,sourceSystem:'relief-governance',kind:'disasterRelief',
      targetRegions:[{region:r.regionId,weight:1}],deltaTrue:delta,linkedIssue:id,policyActionId:r.edictId,
      reason:r.lastReason,tags:['relief','ai-adjudicated']},{turn:G.turn,source:'relief-governance'});
    if(!result || !result.applied)throw new Error('relief-minxin-not-applied');
    var affected=result.result.affectedRegions || [];
    if(leafBefore.some(function(x){return x.div!==target && (x.div.minxin!=null?x.div.minxin:x.div.minxinLocal)!==x.value;}))throw new Error('relief-minxin-target-ambiguous');
    r.settlement={id:settlementId,turn:G.turn,proposedDelta:delta,affectedRegions:copy(affected)};
    return keys.filter(function(k){return staged[k]!==G[k];}).map(function(k){return edit(G,k,staged[k]);}); // arch-ok Publish only the detached MinxinLedger owner result with the case commit.
  }
  function applyAssessment(G,s,report,options) { return safe(function(){
    if(!leaseCurrent(G,s)||!enabled(G))return fail('relief-stale-world');
    if(busy()&&!(options&&options.ownedTurn===true))return fail('relief-world-busy');
    var issue=find(G,s.issueId);if(!issue||issue.relief.revision!==s.revision)return fail('relief-stale-revision');
    if(TERMINAL[issue.relief.status]||issue.relief.lastAssessedTurn===G.turn)return fail('relief-assessment-already-settled');
    report=report||{};if(!text(report.reason,400))return fail('relief-evidence-required');
    if(['wait','blocked','disburse','complete'].indexOf(report.action)<0)return fail('relief-assessment-invalid');
    var r=copy(issue.relief),t=totals(G,issue.id),amount=report.amount==null?0:report.amount,delta=report.minxinDelta==null?0:report.minxinDelta;
    if(!cashValue(amount,false)||typeof delta!=='number'||!Number.isFinite(delta)||Math.abs(delta)>5)return fail('relief-assessment-value-invalid');
    if(amount>cash(t.funded-t.disbursed-t.refunded))return fail('relief-unfunded-disbursement');
    if(report.action==='disburse'&&amount===0)return fail('relief-empty-disbursement');
    if(amount>0 && (r.elapsedDays<=0 || !officer(G,r.assigneeId) || !exact(regions(G),r.regionId)))return fail('relief-execution-prerequisite');
    if((report.action==='wait'||report.action==='blocked') && amount!==0)return fail('relief-blocked-effects');
    // The model, not a timer/random roll, decides the political consequence.
    // Positive effects require real disbursement; overdue promises can lose trust.
    // Per-case cumulative ceilings prevent repeated reward/backlash farming.
    if(delta>0 && ((amount===0&&report.action!=='complete') || (r.rewardApplied||0)+delta>5*(t.disbursed+amount)/r.budget+1e-9))return fail('relief-unearned-reward');
    if(delta<0 && (r.elapsedDays<=r.deadlineDays&&report.action!=='complete' || (r.penaltyApplied||0)-delta>5))return fail('relief-unproven-backlash');
    if(report.action==='complete' && (cash(t.disbursed+amount)!==r.budget || cash(t.funded-t.refunded)!==r.budget))return fail('relief-incomplete-budget');
    r.lastReason=text(report.reason,400);r.officialReport=text(report.officialReport,400);r.nextAdvice=text(report.nextAdvice,240);r.lastTechnicalError='';
    r.consequence=text(report.consequence,400);r.lastAssessedTurn=G.turn;r.revision++;
    if(delta>0)r.rewardApplied=(r.rewardApplied||0)+delta;
    if(delta<0)r.penaltyApplied=(r.penaltyApplied||0)-delta;
    r.status=report.action==='complete'?'completed':report.action==='blocked'?'blocked':t.funded?'executing':'awaiting_funding';
    if(r.investigationRequested && text(report.findings,400)) {r.investigationReport=text(report.findings,400);r.investigationRequested=false;}
    var orders=copy(G.transferOrders||[]),left=amount;
    orders.forEach(function(o){if(o.reliefCaseId!==issue.id)return;var pay=Math.min(left,cash(o.amount-o.deliveredAmount-o.refundedAmount));o.deliveredAmount=cash(o.deliveredAmount+pay);left=cash(left-pay);if(cash(o.deliveredAmount+o.refundedAmount)===o.amount)o.status='relief-delivered';});
    append(r,'推演裁决',r.lastReason+(amount?'；本次发放 '+amount:'')+(delta?'；民心提议 '+(delta>0?'+':'')+delta:''),G);
    var effects=report.action==='complete'||delta!==0?settlementEdits(G,issue.id,r,delta):[];
    publish(changedEdits(G,issue,r,orders).concat(effects));
    return {ok:true,issueId:issue.id,disbursed:amount,settlement:r.settlement||null};
  }); }
  function active(G) { return enabled(G)?cases(G).filter(function(i){return !TERMINAL[i.relief.status];}):[]; }
  function noteFailure(G,s,reason) { return safe(function(){
    if(!leaseCurrent(G,s))return fail('relief-stale-world');
    var issue=find(G,s.issueId);if(!issue||issue.relief.revision!==s.revision)return fail('relief-stale-revision');
    var r=copy(issue.relief);r.lastTechnicalError=text(reason,180);r.revision++;
    publish(changedEdits(G,issue,r));return {ok:true};
  }); }
  function prompt(G,id) {
    var v=view(G,id),ch=v && officer(G,v.assigneeId),region=v && exact(regions(G),v.regionId);
    if(!v)return '';
    var econ=region && region.economyBase || {};
    return JSON.stringify({caseId:id,revision:v.revision,instruction:v.text.slice(0,600),region:{id:v.regionId,name:v.regionName,disasterLevel:region && region.disasterLevel,economy:{agriculture:econ.agriculture,commerce:econ.commerce}},
      assignee:ch?{id:ch.id,name:ch.name,ability:ch.ability,loyalty:ch.loyalty,personality:text(ch.personality,160),relations:Object.keys(ch.relations||{}).slice(0,4).map(function(k){return [k,ch.relations[k]];})}:null,
      budget:v.budget,funded:v.funded,disbursed:v.disbursed,remaining:v.remaining,elapsedDays:v.elapsedDays,deadlineDays:v.deadlineDays,
      rewardApplied:v.rewardApplied||0,penaltyApplied:v.penaltyApplied||0,
      overdue:v.overdue,source:v.source,status:v.status,investigationRequested:v.investigationRequested,history:v.history.slice(-4)});
  }
  TM.ReliefGovernance={enabled:enabled,setEnabled:setEnabled,create:create,act:act,tick:tick,view:view,regions:regions,
    active:active,capture:capture,applyAssessment:applyAssessment,noteFailure:noteFailure,prompt:prompt,labels:LABELS};
})(typeof window!=='undefined'?window:globalThis);
