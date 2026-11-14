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
  // 本路欠账（11-14）：剧本写明承付之路（funding.regionIds / regionId）的军，地方那一份付不足记在 G._armyRetained.byArmy
  //   （tm-fiscal-local-expense.js payArmiesFromRetained），月数按全饷折、可有零头。欠饷月数＝太仓账＋本路账。
  function routeIds(a){var f=a&&a.funding;if(!f||typeof f!=='object')return [];return Array.isArray(f.regionIds)&&f.regionIds.length?f.regionIds:(f.regionId?[f.regionId]:[]);}
  function isRouteFunded(a){var f=a&&a.funding;return !!(f&&!f.selfSupplied&&routeIds(a).length&&(num(f.localShare)||0)>0);}
  function routeRec(g,a){var led=g._armyRetained&&g._armyRetained.byArmy;return led&&led[String(a.id||a.name)]||null;}
  // 军上原有的欠饷月数（开局剧本所欠；或 11-13 存的旧档，那时本路账还没写回军上），第一次对本路账时，多出本路账与太仓账的部分
  //   记进本路账作既欠：钱粮布按本路那份月饷折，并算作已欠下（accruedMonths），军务当它已扣过军心
  function seedRoute(g,a){
    if(a._routeArrearsSeeded)return;a._routeArrearsSeeded=true;
    var rec=routeRec(g,a),had=num(rec&&rec.months)||0,seed=num(a.initialPayArrears&&a.initialPayArrears.months);
    if(seed==null)seed=num(a.payArrearsMonths);
    var v=view({game:g,army:a}),extra=Math.max(0,(seed||0)-had-(v.known?v.exactMonths:0));if(!(extra>1e-9))return;
    var share=Math.max(0,Math.min(1,num(a.funding.localShare)||0)),monthly=monthlyAmounts(a,g,true);
    if(!g._armyRetained||typeof g._armyRetained!=='object')g._armyRetained={byArmy:{}};if(!g._armyRetained.byArmy)g._armyRetained.byArmy={};
    rec=rec||(g._armyRetained.byArmy[String(a.id||a.name)]={name:a.name||a.id,arrears:zero(),months:0,accruedMonths:0,repaidMonths:0,regionIds:routeIds(a).map(String)});
    if(!rec.arrears)rec.arrears=zero();if(rec.accruedMonths==null)rec.accruedMonths=num(rec.months)||0;
    RES.forEach(function(k){rec.arrears[k]=round((num(rec.arrears[k])||0)+monthly[k]*share*extra);});
    rec.months=round(had+extra);rec.accruedMonths=round((num(rec.accruedMonths)||0)+extra);rec.seededMonths=round((num(rec.seededMonths)||0)+extra);
  }
  function routeView(o){var g=G(o),a=o.army;if(!a||!isRouteFunded(a))return {known:false,months:0,accruedMonths:0,repaidMonths:0,amounts:zero()};seedRoute(g,a);var rec=routeRec(g,a);
    if(!rec)return {known:true,months:0,accruedMonths:0,repaidMonths:0,amounts:zero()};
    var m=Math.max(0,num(rec.months)||0),acc=num(rec.accruedMonths);
    return {known:true,months:m,accruedMonths:Math.max(0,acc==null?m:acc),repaidMonths:Math.max(0,num(rec.repaidMonths)||0),amounts:plus(zero(),rec.arrears),regionIds:rec.regionIds||[]};}
  // 军务扣、回军心用（tm-military.js applyPayArrearsPressure）：本路账自上次看过以来新欠下的、本路余钱新还掉的月数，
  //   看过的记在军上（_routeAccruedSeen、_routeRepaidSeen）——同一回合又欠又还时两样各算，不相抵。
  //   军上还没有记号（开局、或 11-13 存的旧档本路账已记却没接军心）：已记的当作已看过，不一次扣下。force＝现欠整笔当新欠。
  function routeDelta(o){var a=o.army,r=routeView(o);if(!r.known)return {known:false,fresh:0,regained:0};
    var sa=Number(a._routeAccruedSeen),sr=Number(a._routeRepaidSeen);if(!isFinite(sa))sa=r.accruedMonths;if(!isFinite(sr))sr=r.repaidMonths;
    var out={known:true,fresh:o.force?r.months:Math.max(0,r.accruedMonths-sa),regained:Math.max(0,r.repaidMonths-sr)};a._routeAccruedSeen=r.accruedMonths;a._routeRepaidSeen=r.repaidMonths;return out;}
  function syncArmy(o){var v=view(o),r=routeView(o);if(r.known)o.army.payArrearsMonths=Math.round(Math.max(0,(v.known?v.exactMonths:0)+r.months));else if(v.known)o.army.payArrearsMonths=v.months;return v;}
  function initializeOne(a,g){
    if(!a||!a.id)return {ok:false,reason:'army-id-required'};var existing=claims(a,g);
    if(existing.items&&existing.items.length){syncArmy({game:g,army:a});return {ok:true,existing:true};}
    // 屯军自给、旧账路上地方出饷的军，开局所欠不记在太仓账上（11-11）
    if(a.funding&&a.funding.selfSupplied)return {ok:true,skipped:true,reason:'self-supplied'};
    if((num(a.funding&&a.funding.localShare)||0)>=1&&!(global.CascadeTax&&global.CascadeTax.isUnified&&global.CascadeTax.isUnified(g,'player')))return {ok:true,skipped:true,reason:'local-funded'};
    var seed=a.initialPayArrears||{},months=num(seed.months!=null?seed.months:a.payArrearsMonths);if(!(months>0))return {ok:true,skipped:true};
    var monthly=monthlyAmounts(a,g,true),amounts=zero(),invalid=false;
    RES.forEach(function(k){var x=seed.amounts?num(seed.amounts[k]!=null?seed.amounts[k]:0):monthly[k]*months;if(x==null||x<0)invalid=true;amounts[k]=round(Math.max(0,x||0));});
    if(invalid||!RES.some(function(k){return amounts[k]>0;}))return {ok:false,reason:'army-arrears-amounts-unknown'};
    var funding=allocations(a,g,amounts);if(funding.missing.length)return {ok:false,reason:'army-arrears-funding-unknown',missing:funding.missing};
    var result=service('recordLiability',{game:g,id:'army-arrears:'+String(g.sid||'')+':'+a.id+':opening',name:(a.name||a.id)+'既欠军饷',category:'junxiang',subject:{kind:'army',id:a.id},allocations:funding.allocations,manualSettlement:true,metadata:{months:months,monthlyAmounts:monthly,incurredTurn:g.turn||0,reason:seed.reason||'开局已有欠饷，待诏给付'}});
    if(result&&result.ok)syncArmy({game:g,army:a});return result||{ok:false,reason:'liability-service-missing'};
  }
  function initialize(o){var g=G(o),report={ok:true,registered:0,existing:0,missing:[]};(g.armies||[]).forEach(function(a){if(!a||!((num(a.initialPayArrears&&a.initialPayArrears.months)||num(a.payArrearsMonths)||0)>0))return;var r=initializeOne(a,g);if(!r.ok){report.ok=false;report.missing.push({armyId:a.id,reason:r.reason,details:r.missing||[]});}else if(r.existing||r.duplicate)report.existing++;else if(!r.skipped)report.registered++;});return report;}
  // 屯军自给、地方出饷的军（11-11）开局所欠不记太仓（见 initializeOne）：补饷时照常返回、不动库、写明缘由。
  //   原先报账簿不全，下诏「补发全部欠饷」整道诏书抛错，发饷按钮报「补饷未能交割」。
  // 本路欠饷由太仓代补（11-14）：接上军心后，朝廷下诏补饷、按发饷按钮，本路所欠从太仓出钱粮布补——太仓有多少补多少，
  //   不欠新账；月数按钱、粮两项里还剩得多的那项同比例减（同本路余钱还旧欠）。回军心在 settleArmyArrears 按补掉的月数算。
  function guokuAvail(g,k){var acc=g.guoku||{},L=acc.ledgers&&acc.ledgers[k],s=num(acc[k]!=null?acc[k]:(k==='money'?acc.balance:null)),l=L?num(L.stock):null;var v=l!=null&&s!=null?Math.min(l,s):(l!=null?l:s);return Math.max(0,v||0);}
  function settleRoute(o){
    var g=G(o),a=o.army,rec=routeRec(g,a);if(!rec)return {ok:true,monthsCleared:0,cost:zero(),paid:zero()};
    var months=Math.max(0,num(rec.months)||0),want=o.months==null?months:Math.min(months,Math.max(0,num(o.months)||0));
    var frac=months>1e-9?Math.min(1,want/months):(o.months==null?1:0),before={},cost=zero(),pay=zero(),paid=zero();
    RES.forEach(function(k){before[k]=Math.max(0,num(rec.arrears&&rec.arrears[k])||0);cost[k]=round(before[k]*frac);pay[k]=round(Math.min(cost[k],guokuAvail(g,k)));});
    if(!RES.some(function(k){return pay[k]>0;}))return {ok:true,monthsCleared:0,cost:cost,paid:paid};
    var spend=global.FiscalEngine&&typeof global.FiscalEngine.spendFromGuoku==='function'?global.FiscalEngine.spendFromGuoku(pay,'补饷·'+(a.name||a.id||'军'),g):null;
    if(!spend||spend.ok===false)return {ok:false,reason:'arrears-payment-unavailable',monthsCleared:0,cost:cost,paid:paid};
    RES.forEach(function(k){var d=spend.deducted&&spend.deducted[k];paid[k]=round(d?num(d.deducted)||0:0);rec.arrears[k]=round(Math.max(0,before[k]-paid[k]));});
    var left=null;['money','grain'].forEach(function(k){if(before[k]>1e-9){var x=rec.arrears[k]/before[k];left=left==null?x:Math.max(left,x);}});
    var after=left==null?months:round(months*Math.min(1,left));rec.months=after;
    return {ok:true,monthsCleared:Math.max(0,round(months-after)),cost:cost,paid:paid};
  }
  function settle(o){
    var a=o&&o.army;if(!a||!isRouteFunded(a))return settleCentral(o);
    var g=G(o),rv=routeView(o),route={ok:true,monthsCleared:0,cost:zero(),paid:zero()};
    if(rv.months>1e-9||RES.some(function(k){return rv.amounts[k]>0;})){route=settleRoute(o);if(route.ok===false)return route;}
    var v=view(o),central=null;
    if(v.claims&&v.claims.length){var rest=o.months==null?undefined:Math.max(0,(num(o.months)||0)-route.monthsCleared);central=settleCentral({game:g,army:a,months:rest,transactionId:o.transactionId,_faultInjector:o._faultInjector});if(!central||central.ok===false)return central;}
    var after=routeView(o);syncArmy(o);
    var cost=plus(plus(zero(),route.cost),central&&central.cost),paid=plus(plus(zero(),route.paid),central&&central.paid),deducted={};
    RES.forEach(function(k){deducted[k]={deducted:paid[k],deficit:round(Math.max(0,cost[k]-paid[k]))};});
    var cleared=round(route.monthsCleared+(central&&!central.skipped?num(central.monthsCleared)||0:0));
    return {ok:true,monthsRequested:o.months==null?null:num(o.months),monthsCleared:cleared,cost:cost,paid:paid,deducted:deducted,remaining:num(a.payArrearsMonths)||0,remainingAmounts:after.amounts,shortfall:deducted.money.deficit,
      note:route.monthsCleared>0?'本路所欠由太仓代补':(rv.months>1e-9?'太仓无钱可补本路所欠':'无欠饷可补'),routeMonthsCleared:route.monthsCleared};
  }
  function settleCentral(o){var g=G(o),a=o.army,initial=view(o);if((!initial.claims||!initial.claims.length)&&!((num(a&&a.payArrearsMonths)||0)>0))return {ok:true,monthsCleared:0,cost:zero(),paid:zero(),deducted:{},remaining:0,remainingAmounts:zero(),shortfall:0};if(!initial.claims||!initial.claims.length){var made=initializeOne(a,g);if(!made.ok)return made;if(made.skipped&&(made.reason==='self-supplied'||made.reason==='local-funded'))return {ok:true,skipped:true,reason:made.reason,note:made.reason==='self-supplied'?'屯军自给，所欠不由太仓支给':'地方存留出饷，所欠不由太仓支给',monthsCleared:0,cost:zero(),paid:zero(),deducted:{},remaining:num(a.payArrearsMonths)||0,remainingAmounts:zero(),shortfall:0};initial=view(o);}if(!initial.known)return {ok:false,reason:'army-arrears-book-incomplete',missing:initial.missing};
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
  TM.MilitaryArrears={initialize:initialize,view:view,routeView:routeView,routeDelta:routeDelta,isRouteFunded:isRouteFunded,syncArmy:syncArmy,settle:settle,monthlyAmounts:monthlyAmounts};
})(typeof window!=='undefined'?window:globalThis);
