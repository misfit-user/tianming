// Army arrears are claims in public ledgers. Months are a projection, never another balance.
(function(global){
  'use strict';
  var TM=global.TM=global.TM||{},RES=['money','grain','cloth'];
  function G(o){return o&&o.game||global.GM||{};}
  function num(v){if(v==null||v===''||typeof v==='string'&&!v.trim())return null;var n=Number(v);return isFinite(n)?n:null;}
  function round(n){return Math.round((n+Number.EPSILON)*10000)/10000;}
  function zero(){return {money:0,grain:0,cloth:0};}
  function plus(a,b){RES.forEach(function(k){a[k]=round(a[k]+(num(b&&b[k])||0));});return a;}
  function service(name,o){var f=global.FiscalEngine,p=TM.PublicTreasury;if(f&&typeof f[name]==='function')return f[name](o);return p&&typeof p[name]==='function'?p[name](o):null;}
  function playerId(g){var p=g.playerInfo||global.P&&global.P.playerInfo||{};return p.factionId||p.factionName||g.playerFactionId;}
  function payerId(a,g){return a.funding&&a.funding.factionId||a.payingFactionId||a.factionId||a.faction||playerId(g);}
  function monthlyAmounts(a,g,wagesOnly){
    var fixed=global.FixedExpense,full=fixed&&fixed.armyMonthlyCost?fixed.armyMonthlyCost(a,{game:g,faction:payerId(a,g)}):null,out=zero(),strength=num(a.payrollStrength!=null?a.payrollStrength:a.soldiers!=null?a.soldiers:a.strength),fallback={money:.5,grain:.3,cloth:.02};
    RES.forEach(function(k){var upkeep=Math.max(0,num(a.monthlyUpkeep&&a.monthlyUpkeep[k])||0);if(full&&num(full[k])!=null)out[k]=round(Math.max(0,full[k]-(wagesOnly?upkeep:0)));else{var rate=num(a['monthly'+k[0].toUpperCase()+k.slice(1)+'PayPerSoldier']);out[k]=round(Math.max(0,strength||0)*(rate==null?fallback[k]:Math.max(0,rate))+(wagesOnly?0:upkeep));}});return out;
  }
  function regionalNodes(g){var out={};function walk(n){if(!n)return;if(n.id)out[n.id]=n;['divisions','children','subRegions'].forEach(function(k){(n[k]||[]).forEach(walk);});}Object.keys(g.adminHierarchy||{}).forEach(function(k){var b=g.adminHierarchy[k];if(Array.isArray(b))b.forEach(walk);else walk(b);});return out;}
  function allocations(a,g,amounts){
    var funding=a.funding||{},payer=payerId(a,g),share=num(funding.localShare),byRef={},missing=[],central=service('getFactionAccountRef',{game:g,factionId:payer,kind:'central'});
    if(share==null)share=a.fiscalFunding==='local'?1:0;share=Math.max(0,Math.min(1,share));var shares={};RES.forEach(function(k){var x=num(funding.localShareByResource&&funding.localShareByResource[k]);shares[k]=Math.max(0,Math.min(1,x==null?share:x));});
    var localIds=[],refs={},nodes={};
    if(RES.some(function(k){return amounts[k]>0&&shares[k]>0;})){
      var regionId=funding.regionId||a.fiscalRegionId||a.locationId||a.garrison||a.location;
      localIds=global.CascadeTax&&global.CascadeTax.fundingRegionIds?global.CascadeTax.fundingRegionIds({game:g,faction:payer,regionId:regionId}):[];
      refs=service('getRegionAccountRefs',{game:g,factionId:payer})||{};nodes=regionalNodes(g);
      if(!localIds.length)missing.push('army-funding-region:'+String(regionId||''));
      localIds.forEach(function(id){if(!refs[id])missing.push('army-regional-account:'+id);});
    }
    function add(ref,k,amount){if(!amount)return;if(!ref){missing.push('army-central-account:'+payer);return;}if(!byRef[ref])byRef[ref]=zero();byRef[ref][k]=round(byRef[ref][k]+amount);}
    RES.forEach(function(k){var local=round(amounts[k]*shares[k]);add(central,k,round(amounts[k]-local));if(!local||!localIds.length)return;
      var weights=localIds.map(function(id){var n=nodes[id]||{},f=n.fiscal||{},v=f.resources&&f.resources[k]&&num(f.resources[k].retainedBudget);if(v!=null)return Math.max(0,v*30/Math.max(.001,num(f.period&&f.period.days)||30));v=f.annualResources&&f.annualResources[k]&&num(f.annualResources[k].retainedBudget);return v==null?0:Math.max(0,v/12);}),sum=weights.reduce(function(a,b){return a+b;},0),left=local;
      if(!sum){weights=localIds.map(function(){return 1;});sum=weights.length;}
      localIds.forEach(function(id,i){var value=i===localIds.length-1?left:Math.min(left,round(local*weights[i]/sum));left=round(left-value);add(refs[id],k,value);});
    });
    return {allocations:Object.keys(byRef).map(function(ref){return {ref:ref,amounts:byRef[ref]};}),missing:missing};
  }
  function claims(a,g){return service('getLiabilities',{game:g,subject:{kind:'army',id:a.id}})||{known:false,items:[],missing:['liability-service-missing']};}
  function claimMonths(c,a,g){var original=c.originalAmounts,basis=original&&c.metadata&&num(c.metadata.months)>0?original:monthlyAmounts(a,g,false),factor=original&&basis===original?Number(c.metadata.months):1,max=0,known=true;
    RES.forEach(function(k){if(c.amounts[k]>0){if(!(basis[k]>0))known=false;else max=Math.max(max,c.amounts[k]/basis[k]*factor);}});return known?max:null;
  }
  function view(o){var g=G(o),a=o.army;if(!a||!a.id)return {known:false,months:null,amounts:null,missing:['army-id-required']};var state=claims(a,g),amounts=zero(),exact=0,known=state.known;
    (state.items||[]).forEach(function(c){plus(amounts,c.amounts);var months=claimMonths(c,a,g);if(months==null)known=false;else exact+=months;});
    if(!state.items.length)return {known:false,months:null,amounts:null,claims:[],missing:state.missing};
    return {known:known,months:known?Math.ceil(Math.max(0,exact-1e-8)):null,exactMonths:known?exact:null,amounts:amounts,claims:state.items,missing:state.missing||[]};
  }
  function syncArmy(o){var v=view(o);if(v.known)o.army.payArrearsMonths=v.months;return v;}
  function initializeOne(a,g){
    if(!a||!a.id)return {ok:false,reason:'army-id-required'};var existing=claims(a,g);
    if(existing.items&&existing.items.length){syncArmy({game:g,army:a});return {ok:true,existing:true};}
    var seed=a.initialPayArrears||{},months=num(seed.months!=null?seed.months:a.payArrearsMonths);if(!(months>0))return {ok:true,skipped:true};
    var monthly=monthlyAmounts(a,g,true),amounts=zero(),invalid=false;
    RES.forEach(function(k){var x=seed.amounts?num(seed.amounts[k]!=null?seed.amounts[k]:0):monthly[k]*months;if(x==null||x<0)invalid=true;amounts[k]=round(Math.max(0,x||0));});
    if(invalid||!RES.some(function(k){return amounts[k]>0;}))return {ok:false,reason:'army-arrears-amounts-unknown'};
    var funding=allocations(a,g,amounts);if(funding.missing.length)return {ok:false,reason:'army-arrears-funding-unknown',missing:funding.missing};
    var result=service('recordLiability',{game:g,id:'army-arrears:'+String(g.sid||'')+':'+a.id+':opening',name:(a.name||a.id)+'既欠军饷',category:'junxiang',subject:{kind:'army',id:a.id},allocations:funding.allocations,manualSettlement:true,metadata:{months:months,monthlyAmounts:monthly,incurredTurn:g.turn||0,reason:seed.reason||'开局已有欠饷，待诏给付'}});
    if(result&&result.ok)syncArmy({game:g,army:a});return result||{ok:false,reason:'liability-service-missing'};
  }
  function initialize(o){var g=G(o),report={ok:true,registered:0,existing:0,missing:[]};(g.armies||[]).forEach(function(a){if(!a||!((num(a.initialPayArrears&&a.initialPayArrears.months)||num(a.payArrearsMonths)||0)>0))return;var r=initializeOne(a,g);if(!r.ok){report.ok=false;report.missing.push({armyId:a.id,reason:r.reason,details:r.missing||[]});}else if(r.existing||r.duplicate)report.existing++;else if(!r.skipped)report.registered++;});return report;}
  function settle(o){var g=G(o),a=o.army,initial=view(o);if((!initial.claims||!initial.claims.length)&&!((num(a&&a.payArrearsMonths)||0)>0))return {ok:true,monthsCleared:0,cost:zero(),paid:zero(),deducted:{},remaining:0,remainingAmounts:zero(),shortfall:0};if(!initial.claims||!initial.claims.length){var made=initializeOne(a,g);if(!made.ok)return made;initial=view(o);}if(!initial.known)return {ok:false,reason:'army-arrears-book-incomplete',missing:initial.missing};
    var want=o.months==null?initial.exactMonths:Math.min(initial.exactMonths,Math.max(0,num(o.months)||0)),left=want,cost=zero(),paid=zero(),duplicate=true,results=[];
    if(want<=0)return {ok:true,monthsRequested:0,monthsCleared:0,cost:cost,deducted:{},remaining:0,remainingAmounts:initial.amounts,shortfall:0,note:'无欠饷可补'};
    var actionId=o.transactionId||'army-arrears-payment:'+String(g.sid||'')+':'+(g.turn||0)+':'+a.id+':'+JSON.stringify(initial.amounts);
    for(var i=0;i<initial.claims.length&&left>1e-8;i++){
      var claim=initial.claims[i],months=claimMonths(claim,a,g);if(!(months>0))continue;var fraction=Math.min(1,left/months),amounts=zero();RES.forEach(function(k){amounts[k]=round(claim.amounts[k]*fraction);});left=Math.max(0,left-months*fraction);plus(cost,amounts);
      var r=service('repayLiability',{game:g,id:claim.id,amounts:fraction===1?undefined:amounts,transactionId:actionId+':'+claim.id,allowPartial:true,reason:'补饷·'+(a.name||a.id),_faultInjector:o._faultInjector});
      if(!r||!r.ok){syncArmy(o);return r||{ok:false,reason:'liability-service-missing'};}plus(paid,r.paid);duplicate=duplicate&&r.duplicate===true;results.push(r);
    }
    var after=syncArmy(o),deducted={};RES.forEach(function(k){deducted[k]={deducted:paid[k],deficit:round(Math.max(0,cost[k]-paid[k]))};});
    return {ok:true,duplicate:duplicate,monthsRequested:want,monthsCleared:duplicate?0:Math.max(0,initial.months-after.months),cost:cost,paid:paid,deducted:deducted,remaining:after.months,remainingAmounts:after.amounts,shortfall:deducted.money.deficit,payments:results};
  }
  TM.MilitaryArrears={initialize:initialize,view:view,syncArmy:syncArmy,settle:settle,monthlyAmounts:monthlyAmounts};
})(typeof window!=='undefined'?window:globalThis);
