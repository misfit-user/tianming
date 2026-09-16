// @ts-check
// Explicit character accounts: personal stock, productive assets and entrusted funds.
// Scenario opt-in; all historical estimates remain scenario data.
(function(global) {
  'use strict';
  var TM = global.TM = global.TM || {};
  var SCHEMA = 'tm-character-economy/2';
  var RES = ['money','grain','cloth'];
  function n(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
  function round(v) { return Math.round((v + Number.EPSILON) * 10000) / 10000; }
  function clone(v) { return JSON.parse(JSON.stringify(v == null ? null : v)); }
  function zero() { return {money:0,grain:0,cloth:0}; }
  function bag(v) { var out=zero();RES.forEach(function(k){out[k]=n(v&&v[k]);});return out; }
  function add(a,b,scale) { RES.forEach(function(k){a[k]=round(n(a[k])+n(b&&b[k])*(scale == null?1:scale));});return a; }
  function root() { return global.GM || {}; }
  function scenario() {
    var G=root(),sc=null;
    try { if(typeof global.findScenarioById==='function')sc=global.findScenarioById(G.sid); } catch(_){}
    if(!sc&&global.P&&(!global.P.id||global.P.id===G.sid))sc=global.P;
    return sc || {};
  }
  function isDeclared(ch) {
    var ac=ch&&ch.economyConfig&&ch.economyConfig.accounting;
    var pw=ch&&ch.resources&&ch.resources.privateWealth;
    if(ac&&ac.schema===SCHEMA)return true;
    if(pw&&pw.accounting&&pw.accounting.schema===SCHEMA)return true;
    var sc=scenario(),cfg=sc.characterEconomyConfig;
    return !!(cfg&&cfg.accounting&&cfg.accounting.schema===SCHEMA);
  }
  function config(ch) { return ch&&ch.economyConfig||{}; }
  function ensure(ch) {
    if(!ch||!isDeclared(ch))return null;
    ch.resources=ch.resources||{};
    var pw=ch.resources.privateWealth=ch.resources.privateWealth||{};
    RES.concat(['land','treasure','slaves','commerce','debt']).forEach(function(k){if(typeof pw[k]!=='number'||!isFinite(pw[k]))pw[k]=0;});
    // An emperor's private purse does not become the palace treasury by office.
    delete pw.isNeitang;delete pw.leaderScope;delete pw.factionName;
    pw.accounting={schema:SCHEMA};
    ch.economyLedger=ch.economyLedger||{schema:SCHEMA,salaryReceiptIds:[],entries:[],arrears:zero()};
    ch.economyLedger.salaryReceiptIds=ch.economyLedger.salaryReceiptIds||[];
    ch.economyLedger.entries=ch.economyLedger.entries||[];
    ch.economyLedger.arrears=ch.economyLedger.arrears||zero();
    return pw;
  }
  function readPrivate(ch) {
    var pw=ch&&ch.resources&&ch.resources.privateWealth;
    if(!pw)return {known:false,stock:null};
    var out=Object.assign(clone(pw),{known:true,stock:bag(pw)}),assets=scenario().characterEconomyConfig&&scenario().characterEconomyConfig.assets||[];
    ['landHoldings','houses','shops','treasures','familyBusiness','investments','livestock'].forEach(function(k){out[k]=(out[k]||[]).map(function(a){var found=assets.find(function(r){return r&&r.id===(a.assetId||a.id);});return found?Object.assign(clone(found),a):a.assetId&&!a.tenure?Object.assign({},a,{unresolvedReference:true}):a;});});
    return out;
  }
  function ownShare(a) {
    if(a&&(a.unresolvedReference||a.tenure==='office'||a.tenure==='temple'||a.tenure==='family'||a.tenure==='leased'||a.tenure==='residence'||a.ownership==='entrusted'))return 0;
    return a&&typeof a.ownershipShare==='number'?Math.max(0,Math.min(1,a.ownershipShare)):1;
  }
  function summarize(ch) {
    var pw=readPrivate(ch),stock=pw.stock||zero(),debt=zero(),value=0,area=0,unpriced=0,seen={};
    if(Array.isArray(pw.debts)&&pw.debts.length)pw.debts.forEach(function(d){if(d.status!=='paid'){var a=typeof d.amount==='number'?{money:d.amount}:d.amount||d.principal;add(debt,typeof a==='number'?{money:a}:a);}});
    else debt.money=n(pw.debt);
    ['landHoldings','houses','shops','treasures','familyBusiness','investments','livestock'].forEach(function(key){
      (Array.isArray(pw[key])?pw[key]:[]).forEach(function(a){var id=a.assetId||a.id;if(id&&seen[id])return;if(id)seen[id]=true;var share=ownShare(a);if(key==='landHoldings')area+=n(a.area)*share;if(!share)return;if(typeof a.estimatedValue==='number')value+=Math.max(0,a.estimatedValue)*share;else unpriced++;});
    });
    if(!Array.isArray(pw.landHoldings)||!pw.landHoldings.length)area=n(pw.land);
    if(!Array.isArray(pw.treasures)||!pw.treasures.length)value+=Math.max(0,n(pw.treasure));
    if((!Array.isArray(pw.shops)||!pw.shops.length)&&(!Array.isArray(pw.familyBusiness)||!pw.familyBusiness.length))value+=Math.max(0,n(pw.commerce));
    var arrears=bag(ch&&ch.economyLedger&&ch.economyLedger.arrears);
    return {known:pw.known,money:stock.money,grain:stock.grain,cloth:stock.cloth,stock:stock,landArea:round(area),debt:debt,arrears:arrears,assetEstimateMoney:round(value),unpricedAssets:unpriced,totalValue:{money:round(stock.money+value-debt.money-arrears.money),grain:round(stock.grain-debt.grain-arrears.grain),cloth:round(stock.cloth-debt.cloth-arrears.cloth)}};
  }
  function publicAccounts(ch) {
    var F=global.FiscalEngine;
    if(F&&typeof F.getCharacterPublicAccounts==='function')return F.getCharacterPublicAccounts({game:root(),characterId:ch&&ch.id});
    return {known:false,accounts:[],resources:null};
  }
  function publicDisplay(ch) {
    var view=publicAccounts(ch),tot=view.resources||{},out={known:view.known===true,accounts:clone(view.accounts||[]),money:0,grain:0,cloth:0,deficit:0,isReadOnly:true,isInherited:false,linkedPost:null,linkedRegion:null,isGuoku:false};
    out.deficits=zero();RES.forEach(function(k){out[k]=n(tot[k]&&tot[k].stock);out.deficits[k]=n(tot[k]&&tot[k].deficit);});out.deficit=out.deficits.money;
    if(out.accounts.length)out.linkedPost=out.accounts.map(function(a){return a.name;}).join('、');
    return out;
  }
  function refreshPublic(ch) {
    if(!ensure(ch))return null;
    var view=publicDisplay(ch),r=ch.resources;
    r.entrustedAccounts={known:view.known,accounts:clone(view.accounts),isReadOnly:true};
    r.publicTreasury={known:view.known,linkedPost:view.linkedPost,linkedRegion:null,balance:view.money,grain:view.grain,cloth:view.cloth,deficit:view.deficit,isReadOnly:true,accounts:clone(view.accounts)};
    r.publicPurse={known:view.known,money:view.money,grain:view.grain,cloth:view.cloth,isReadOnly:true};
    return view;
  }
  function payroll(ch,days) {
    var F=global.FiscalEngine;
    if(F&&typeof F.getCharacterPayroll==='function')return F.getCharacterPayroll({game:root(),characterId:ch&&ch.id,days:days==null?30:days});
    return {known:false,due:zero(),paid:zero(),receipts:[]};
  }
  function record(ch,entry) {
    var l=ch.economyLedger;
    entry.turn=root().turn||0;l.entries.push(entry);
    if(l.entries.length>120)l.entries=l.entries.slice(-120);
  }
  function transferFromPublic(ch,o) {
    o=o||{};if(!ensure(ch))return {ok:false,reason:'legacy-accounting'};
    var F=global.FiscalEngine;
    if(!o.id||!o.fundId||!F||typeof F.trySpendFromAccount!=='function')return {ok:false,reason:'payment-source-missing'};
    var requested=bag(o.amount);if(RES.some(function(k){return requested[k]<0;}))return {ok:false,reason:'invalid-payment'};
    var payment=F.trySpendFromAccount({game:root(),from:o.fundId,amounts:requested,allowPartial:true,transactionId:o.id,reason:o.reason||'给付个人',_faultInjector:o._faultInjector});
    if(!payment||!payment.ok)return payment||{ok:false,reason:'payment-failed'};
    var l=ch.economyLedger,share=o.privateShare==null?1:Math.max(0,Math.min(1,n(o.privateShare))),received=add(zero(),payment.paid,share),remainder=add(bag(payment.paid),received,-1);
    l.publicPaymentIds=l.publicPaymentIds||[];
    if(l.publicPaymentIds.indexOf(o.id)>=0)return {ok:true,duplicate:true,paid:bag(payment.paid),received:received,remainder:remainder,shortfall:bag(payment.shortfall)};
    if(!RES.some(function(k){return n(payment.paid&&payment.paid[k])>0;}))return {ok:true,paid:zero(),received:zero(),remainder:zero(),shortfall:bag(payment.shortfall)};
    add(ch.resources.privateWealth,received);l.publicPaymentIds.push(o.id);
    record(ch,{id:o.id,kind:o.kind||'public-payment',label:o.reason||'公库给付收讫',direction:'income',amount:received,fundId:o.fundId,paid:bag(payment.paid),shortfall:bag(payment.shortfall),remainder:remainder,remainderDestination:RES.some(function(k){return remainder[k]>0;})?(o.remainderDestination||'经手人分取及去向待核'):'无'});
    if(l.lastSettlement&&l.lastSettlement.turn===(root().turn||0)){add(l.lastSettlement.income,received);l.lastSettlement.items.push(clone(l.entries[l.entries.length-1]));ch._lastTickNet=round(n(ch._lastTickNet)+received.money);}
    return {ok:true,transactionId:o.id,paid:bag(payment.paid),received:received,remainder:remainder,shortfall:bag(payment.shortfall)};
  }
  function regionAccountRef(div) {
    var G=root(),cfg=G.publicTreasuryConfig||scenario().publicTreasuryConfig||{};
    var hit=(cfg.accounts||[]).find(function(a){return a&&a.kind!=='pool'&&a.source&&a.source.kind==='region'&&a.source.id===(div&&div.id);});
    return hit&&hit.id||null;
  }
  function factionAccountRef(ch) {
    var G=root(),sc=scenario(),p=G.playerInfo||sc.playerInfo||{},fid=ch&&(ch.factionId||ch.faction)||G.playerFactionId||p.factionId||p.factionName;
    var F=global.FiscalEngine;return fid&&F&&typeof F.getFactionAccountRef==='function'?F.getFactionAccountRef({game:G,factionId:fid,kind:'central'}):null;
  }
  function applyLocalDiversion(div,action,index) {
    if(!div||!action||action.type!=='illicit')return {handled:false};
    var G=root(),ch=(G.chars||[]).find(function(c){return c&&(c.id===div.governorId||c.name===div.governor);});
    if(!isDeclared(ch))return {handled:false};
    if(!ch)return {handled:true,ok:false,reason:'查无实际收款的地方主官'};
    var id=action.transactionId||action.id||('local-illicit:'+G.sid+':'+G.turn+':'+div.id+':'+index);
    var result=transferFromPublic(ch,{id:id,fundId:regionAccountRef(div),amount:{money:Math.max(0,Number(action.amount)||0)},privateShare:.6,kind:'illicit',reason:action.reason||'地方侵夺',remainderDestination:'经手人分取及去向待核'});
    if(!result.ok)return {handled:true,ok:false,reason:'地方库未实际支出',detail:result.reason};
    if(result.duplicate)return {handled:true,ok:true,duplicate:true};
    if(!result.paid.money)return {handled:true,ok:false,reason:'地方库无款可支',detail:'insufficient-local-funds'};
    div.fiscal=div.fiscal||{};div.fiscal.expenditures=div.fiscal.expenditures||{fixed:[],discretionary:[],imperial:[],illicit:[],downstream:[]};
    div.fiscal.expenditures.illicit=div.fiscal.expenditures.illicit||[];
    div.fiscal.expenditures.illicit.push({id:id,type:'illicit',amount:result.paid.money,requestedAmount:Math.max(0,Number(action.amount)||0),privateRecipientId:ch.id,privateReceived:result.received.money,untracedAmount:result.remainder.money,remainderDestination:'经手人分取及去向待核',reason:action.reason||'',turn:G.turn||0});
    return {handled:true,ok:true,report:{type:'localAction',region:action.region,actionType:'illicit',amount:result.paid.money,privateReceived:result.received.money,untracedAmount:result.remainder.money,reason:action.reason,turn:G.turn||0}};
  }
  // The applier supplies its outcome queues; treasury and receipt handling stay here.
  function handleLocalDiversion(div,action,index,failed,reports) {
    var result=applyLocalDiversion(div,action,index);
    if(!result.handled)return false;
    if(!result.ok&&Array.isArray(failed))failed.push({localAction:action,reason:result.reason,detail:result.detail});
    else if(!result.duplicate&&result.report&&Array.isArray(reports))reports.push(result.report);
    return true;
  }
  function receiveSalaryPayment(ch,payment) {
    if(!ch||!isDeclared(ch))return {ok:false,reason:'legacy-accounting'};
    if(!payment||!payment.id||payment.paid!==true||payment.characterId!==ch.id)return {ok:false,reason:'invalid-payment-receipt'};
    if(!payment.amount||RES.some(function(k){return payment.amount[k]!=null&&(typeof payment.amount[k]!=='number'||!isFinite(payment.amount[k])||payment.amount[k]<0);}))return {ok:false,reason:'invalid-payment-amount'};
    var authoritative=(root()._salaryPaymentReceipts||[]).find(function(r){return r&&r.id===payment.id&&r.characterId===ch.id&&r.paid===true;});
    if(!authoritative||RES.some(function(k){return n(authoritative.amount&&authoritative.amount[k])!==n(payment.amount[k]);}))return {ok:false,reason:'unfunded-payment'};
    var pw=ensure(ch),l=ch.economyLedger;
    if(l.salaryReceiptIds.indexOf(payment.id)>=0)return {ok:false,duplicate:true,reason:'already-received'};
    var amount=bag(authoritative.amount);add(pw,amount);l.salaryReceiptIds.push(payment.id);
    var entry={id:payment.id,kind:'salary',label:'俸料收讫',direction:'income',amount:amount,payerId:payment.payerId,fundId:payment.fundId,positionId:payment.positionId};
    record(ch,entry);
    if(l.lastSettlement&&l.lastSettlement.turn===(root().turn||0)){add(l.lastSettlement.income,amount);l.lastSettlement.items.push(clone(entry));ch._lastTickIncome=ch._lastTickIncome||{};ch._lastTickIncome['俸料收讫']=round(n(ch._lastTickIncome['俸料收讫'])+amount.money);ch._lastTickNet=round(n(ch._lastTickNet)+amount.money);}
    return {ok:true,amount:amount,receiptId:payment.id};
  }
  function settleSalaryReceipts(ch) {
    if(!ensure(ch))return {ok:false,reason:'legacy-accounting'};
    var F=global.FiscalEngine,p;
    if(F&&typeof F.getCharacterSalaryReceipts==='function')p=F.getCharacterSalaryReceipts({game:root(),characterId:ch.id});
    else p={known:Array.isArray(root()._salaryPaymentReceipts),receipts:(root()._salaryPaymentReceipts||[]).filter(function(r){return r&&r.characterId===ch.id&&r.turn===(root().turn||0);})};
    if(Array.isArray(p))p={known:true,receipts:p};p=p||{known:false,receipts:[]};
    var received=zero(),paid=zero(),count=0;
    (p.receipts||[]).forEach(function(r){var result=receiveSalaryPayment(ch,r);if(result.ok){add(received,result.amount);count++;}});
    (p.receipts||[]).forEach(function(r){add(paid,r.amount);});
    return {ok:true,known:p.known===true,received:received,count:count,paid:paid};
  }
  function periodMonth() {
    var G=root(),sc=scenario(),t=sc.time||{},day=n(G.currentDay)+(n(t.startMonth)||1)*30-30+(n(t.startDay)||1)-1;
    return Math.floor(((day%360)+360)%360/30)+1;
  }
  function flowAmount(stream,mr) {
    var months=stream.months,scale=mr;
    if(Array.isArray(months)&&months.length){if(months.indexOf(periodMonth())<0)return zero();scale*=12/months.length;}
    var amount=stream.monthly||stream.amountPerMonth;
    if(!amount){amount=stream.annual||stream.amountPerYear;scale/=12;}
    return add(zero(),amount,scale);
  }
  function tickCharacter(ch,mr) {
    if(!ch||ch.dead||ch.alive===false||!ensure(ch))return {ok:false,reason:'inactive'};
    var l=ch.economyLedger,G=root(),turn=G.turn||0;
    settleSalaryReceipts(ch);
    if(l.lastSettledTurn===turn)return {ok:false,duplicate:true};
    mr=typeof mr==='number'&&isFinite(mr)&&mr>0?mr:1;
    var pw=ch.resources.privateWealth,resolved=readPrivate(ch),cfg=config(ch),income=zero(),expense=zero(),unpaid=zero(),items=[];
    l.entries.forEach(function(e){if((e.kind==='salary'||e.fundId)&&e.turn===turn&&e.direction==='income'){add(income,e.amount);items.push(clone(e));}});
    (cfg.incomeStreams||[]).forEach(function(s){
      if(!s||['rent','farm','trade','craft','labor','pastoral','fishery','service'].indexOf(s.kind)<0)return;
      if(s.assetId&&!['landHoldings','houses','shops','investments','livestock','familyBusiness'].some(function(k){return(resolved[k]||[]).some(function(a){return(a.assetId||a.id)===s.assetId&&(ownShare(a)>0||(s.kind==='farm'&&a.tenure==='leased'));});}))return;
      var amount=flowAmount(s,mr);RES.forEach(function(k){amount[k]=Math.max(0,amount[k]);});
      add(pw,amount);add(income,amount);items.push({id:s.id,kind:s.kind,label:s.label||'生计进项',direction:'income',amount:amount});
    });
    var bills=(cfg.expenseStreams||[]).slice();
    (pw.debts||[]).forEach(function(d){if(d.status==='paid')return;var rate=n(d.monthlyRate);if(rate<=0)return;var principal=typeof d.amount==='number'?{money:d.amount}:d.amount||{};bills.push({id:d.id,label:'息钱',kind:'interest',monthly:add(zero(),principal,rate)});});
    bills.forEach(function(s){var due=flowAmount(s,mr),paid=zero(),shortage=zero();RES.forEach(function(k){var v=Math.max(0,n(due[k]));paid[k]=Math.min(Math.max(0,n(pw[k])),v);pw[k]=round(n(pw[k])-paid[k]);shortage[k]=round(v-paid[k]);});add(expense,paid);add(unpaid,shortage);items.push({id:s.id,kind:s.kind||'household',label:s.label||'日用支出',direction:'expense',amount:paid,due:due,unpaid:shortage});});
    add(l.arrears,unpaid);items.forEach(function(e){if(e.kind!=='salary'&&!e.fundId)record(ch,e);});
    l.lastSettledTurn=turn;l.lastSettlement={turn:turn,periodDays:mr*30,income:income,expense:expense,unpaid:unpaid,items:items};
    ch._lastTickIncome={};ch._lastTickExpense={};items.forEach(function(e){var dst=e.direction==='income'?ch._lastTickIncome:ch._lastTickExpense;dst[e.label]=n(dst[e.label])+e.amount.money;});
    ch._lastTickNet=round(income.money-expense.money);
    return {ok:true,income:income,expense:expense,unpaid:unpaid};
  }
  function inherit(ch) {
    if(!ensure(ch))return {ok:false,reason:'legacy-accounting'};
    var l=ch.economyLedger;if(l.estateTransferred)return {ok:false,duplicate:true};
    var ids=config(ch).estateHeirIds||(ch.family&&ch.family.children)||[];
    var heirs=ids.map(function(id){return(root().chars||[]).find(function(c){return c&&c.id===id&&c.alive!==false&&!c.dead&&isDeclared(c);});}).filter(Boolean);
    if(!heirs.length){l.estateStatus='awaiting-heirs';return {ok:false,reason:'awaiting-heirs'};}
    var pw=ch.resources.privateWealth,resolved=readPrivate(ch),share=1/heirs.length;
    heirs.forEach(function(h){var dest=ensure(h);if(!dest)return;add(dest,pw,share);['land','treasure','commerce','debt'].forEach(function(k){dest[k]=round(n(dest[k])+n(pw[k])*share);});['landHoldings','houses','shops','treasures','investments','debts','livestock','familyBusiness'].forEach(function(k){(resolved[k]||[]).forEach(function(a){if(!ownShare(a))return;dest[k]=dest[k]||[];var part=clone(a);if(k==='debts'){part.amount=typeof a.amount==='number'?a.amount*share:add(zero(),a.amount,share);}else{part.ownershipShare=ownShare(a)*share;part.ownerEntityId='household:'+h.id;}dest[k].push(part);});});record(h,{kind:'inheritance',label:'承受遗产',direction:'income',fromCharacterId:ch.id,amount:add(zero(),pw,share)});});
    l.estateTransferred=true;l.estateTransfer={turn:root().turn,heirIds:heirs.map(function(h){return h.id;}),stock:bag(pw)};
    RES.concat(['land','treasure','commerce','slaves','debt']).forEach(function(k){pw[k]=0;});['landHoldings','houses','shops','treasures','investments','debts','livestock','familyBusiness'].forEach(function(k){pw[k]=[];});
    return {ok:true,heirIds:l.estateTransfer.heirIds};
  }
  function confiscate(ch,opts) {
    if(!ensure(ch))return {success:false,reason:'无此人的私产簿'};
    if(ch.confiscated)return {success:false,reason:'已经籍没'};
    opts=opts||{};var F=global.FiscalEngine,pw=ch.resources.privateWealth,dest=opts.destination==='neitang'?'neitang':'guoku';
    if(!F||typeof F.receivePrivateRecovery!=='function')return {success:false,reason:'尚未指定可以交納的府库'};
    var rate=Math.max(0,Math.min(1,opts.intensity==null?.5:n(opts.intensity))),hidden=Math.max(0,n(ch.resources.hiddenWealth))*rate;
    var recovered=bag(pw);RES.forEach(function(k){recovered[k]=Math.max(0,recovered[k]);});recovered.money+=hidden;
    var resolved=readPrivate(ch),estate={destination:dest,turn:root().turn,stock:clone(recovered),assets:{},debts:clone(pw.debts||[])};
    ['landHoldings','houses','shops','treasures','investments','livestock','familyBusiness'].forEach(function(k){estate.assets[k]=(resolved[k]||[]).filter(function(a){return ownShare(a)>0;}).map(clone);});
    estate.landArea=summarize(ch).landArea;estate.unliquidatedEstimate=n(pw.treasure)+n(pw.commerce);
    var recoveryId='private-recovery:'+String(root().sid||'')+':'+String(root().turn||0)+':'+ch.id;
    try { var result=F.receivePrivateRecovery({game:root(),characterId:ch.id,destination:dest,amount:bag(pw),hiddenMoney:hidden,id:recoveryId,reason:'籍没'+ch.name+'已点验钱粮',_faultInjector:opts._faultInjector});if(!result||!result.ok)return {success:false,reason:'府库尚未收讫，原财物暂依旧保管',detail:result&&result.reason}; } catch(e){return {success:false,reason:'交割未成，须复核府库簿册',detail:String(e.message||e)};}
    ch.economyLedger.estateSeizure=estate;
    RES.concat(['land','treasure','commerce','slaves']).forEach(function(k){pw[k]=0;});Object.keys(estate.assets).forEach(function(k){pw[k]=(resolved[k]||[]).filter(function(a){return ownShare(a)===0;}).map(clone);});
    ch.confiscated=true;ch.retired=true;ch.status='disgraced';
    return {success:true,total:recovered.money,visible:recovered.money-hidden,hidden:hidden,recovered:recovered,assets:clone(estate.assets),destination:dest,unliquidated:true};
  }
  TM.CharacterEconomyLedger={SCHEMA:SCHEMA,isDeclared:isDeclared,ensure:ensure,readPrivate:readPrivate,summarize:summarize,publicAccounts:publicAccounts,publicDisplay:publicDisplay,refreshPublic:refreshPublic,payroll:payroll,receiveSalaryPayment:receiveSalaryPayment,settleSalaryReceipts:settleSalaryReceipts,transferFromPublic:transferFromPublic,applyLocalDiversion:applyLocalDiversion,handleLocalDiversion:handleLocalDiversion,regionAccountRef:regionAccountRef,factionAccountRef:factionAccountRef,tickCharacter:tickCharacter,inherit:inherit,confiscate:confiscate};
})(typeof window!=='undefined'?window:globalThis);
