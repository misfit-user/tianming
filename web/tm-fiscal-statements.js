// Shared fiscal field meanings: annual category bags, period ledgers, separate stocks.
(function(global) {
  'use strict';
  var RES=['money','grain','cloth'];
  var IN={tianfu:'田赋',dingshui:'丁税',caoliang:'漕粮',yanlizhuan:'盐铁专卖',shipaiShui:'市舶',quanShui:'榷税',juanNa:'捐纳',qita:'其他',mining:'矿冶',fishingTax:'渔课'};
  var OUT={fenglu:'俸禄',junxiang:'军饷',zhenzi:'赈济',gongcheng:'工程',jisi:'祭祀',shangci:'赏赐',neiting:'内廷转运',qita:'其他'};
  var INNER_IN={huangzhuang:'皇庄',huangchan:'皇产',specialTax:'特别税',confiscation:'抄没',tribute:'朝贡',guokuTransfer:'帑廪转运',other:'其他'};
  var INNER_OUT={gongting:'宫廷',dadian:'大典',shangci:'赏赐',houGongLingQin:'后宫陵寝',guokuRescue:'接济帑廪',other:'其他'};
  function num(v){return typeof v==='number'&&isFinite(v)?v:0;}
  function round(v){return Math.round(v*1e8)/1e8;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function zero(){return {money:0,grain:0,cloth:0};}
  function labels(scope,direction){return scope==='internal'?(direction==='in'?INNER_IN:INNER_OUT):(direction==='in'?IN:OUT);}
  function keyFor(tag,scope,direction){
    var map=labels(scope,direction),key=Object.keys(map).find(function(k){return k===tag||map[k]===tag;});
    if(key)return key;
    if(scope!=='internal'&&direction==='in'){
      var aliases={tianfu_money:'tianfu',land_money:'tianfu',land_silver:'tianfu',land_grain:'tianfu',land_cloth:'tianfu',ding:'dingshui',yanke:'yanlizhuan',salt_iron:'yanlizhuan',salt_hedong:'yanlizhuan',salt_sichuan:'yanlizhuan',salt_retained:'yanlizhuan',tea:'quanShui',wine:'quanShui',commerce:'quanShui',chake:'quanShui',jiuke:'quanShui',shangShui:'quanShui',shibo:'shipaiShui',maritime:'shipaiShui',kuangye:'mining'};
      if(aliases[tag])return aliases[tag];
    }
    return scope==='internal'?'other':'qita';
  }
  function expenseKey(item,scope){
    if(scope==='internal')return item.destination==='guoku'?'guokuRescue':keyFor(item.sourceTag||'gongting',scope,'out');
    if(item.destination==='neitang')return 'neiting';
    if(item.category==='army')return 'junxiang';
    if(item.category==='salary'||item.category==='administration')return 'fenglu';
    return keyFor(item.sourceTag,scope,'out');
  }
  function expenseLabel(item){var scope=item.funding==='internal'?'internal':'central';return labels(scope,'out')[expenseKey(item,scope)];}
  function flowTag(entry,scope,direction){
    var map=labels(scope,direction),tag=entry.sourceTag||entry.category||'',key=Object.keys(map).find(function(k){return k===tag||map[k]===tag;});
    if(!key&&direction==='out')key=expenseKey({sourceTag:tag,category:entry.category},scope);
    key=key||(scope==='internal'?'other':'qita');return {key:key,label:map[key]};
  }
  function add(map,key,value){if(value)map[key]=round(num(map[key])+value);}
  function detail(map,key,id,name,amount){
    if(!amount)return;if(!map[key])map[key]=[];
    var row=map[key].find(function(r){return r.id===id;});
    if(!row){row={id:id,name:name,amount:0};map[key].push(row);}row.amount=round(row.amount+amount);
  }
  function recordExpense(ledger,item,amount,unpaid){
    var scope=item.funding==='internal'?'internal':'central',key=expenseKey(item,scope),id=item.expenseId||item.positionId||item.armyId||item.name;
    if(amount){if(!ledger.sinkDetails)ledger.sinkDetails={};detail(ledger.sinkDetails,key,id,itemName(item,scope),amount);}
    if(unpaid){if(!ledger.deficitDetails)ledger.deficitDetails={};detail(ledger.deficitDetails,key,id,itemName(item,scope),unpaid);}
  }
  function recordFlow(ledger,scope,direction,tag,id,name,amount){
    var field=direction==='in'?'sourceDetails':'sinkDetails',key=keyFor(tag,scope,direction);
    if(!ledger[field])ledger[field]={};detail(ledger[field],key,id,name,amount);
  }
  function repayDeficits(ledger,amount,options){
    var all=Object.keys(ledger.deficitDetails||{}).reduce(function(a,k){return a.concat(ledger.deficitDetails[k]);},[]),manual=options&&options.excludeManual?all.filter(function(r){return r.manualSettlement===true;}).reduce(function(n,r){return n+num(r.amount);},0):0;
    var rows=all.filter(function(r){return !(options&&options.excludeManual&&r.manualSettlement===true);}),sum=rows.reduce(function(n,r){return n+r.amount;},0);
    var left=Math.max(0,amount-Math.max(0,num(ledger.deficit)-manual+amount-sum));
    rows.forEach(function(r){var paid=Math.min(left,r.amount);r.amount=round(r.amount-paid);left=round(left-paid);});
  }
  function itemName(item,scope){
    var label=labels(scope,'out')[expenseKey(item,scope)];
    return item.sourceName&&item.sourceName!==label&&item.sourceName!==item.name?item.sourceName+' · '+item.name:item.name;
  }
  function budgetFlows(budget,scope){
    var result={},items=budget.expenses.items||[];
    RES.forEach(function(k){result[k]={sources:{},sinks:{},sourceDetails:{},sinkDetails:{},income:0,expense:0};});
    if(scope==='internal')items.forEach(function(r){
      if(r.destination!=='neitang')return;
      RES.forEach(function(k){var flow=result[k],v=num(r.amounts[k]);add(flow.sources,'guokuTransfer',v);detail(flow.sourceDetails,'guokuTransfer',r.expenseId||r.name,r.name,v);flow.income=round(flow.income+v);});
    });
    else (budget.regions||[]).forEach(function(r){(r.taxes||[]).forEach(function(t){
      var flow=result[t.resource];if(!flow)return;var key=keyFor(t.sourceTag||t.id,scope,'in');
      add(flow.sources,key,t.central);detail(flow.sourceDetails,key,t.id,t.name,t.central);flow.income=round(flow.income+num(t.central));
    });});
    items.filter(function(r){return r.funding===(scope==='internal'?'internal':'central');}).forEach(function(r){
      var key=expenseKey(r,scope),label=labels(scope,'out')[key];
      RES.forEach(function(k){var flow=result[k],v=num(r.amounts[k]);add(flow.sinks,label,v);detail(flow.sinkDetails,key,r.expenseId||r.positionId||r.armyId||r.name,itemName(r,scope),v);flow.expense=round(flow.expense+v);});
    });
    return result;
  }
  function flowIsActual(o){
    if(o.actual!=null)return !!o.actual;
    var G=o.game||{},a=o.account||{},marker=o.marker||G,turn=G.turn||0;
    var native=G.nativeWorld||{},player=G.startContext&&G.startContext.playerFactionId,kind=o.scope==='internal'?'private':'public';
    var nativeActual=a===G[kind==='private'?'neitang':'guoku']&&(native.accounts||[]).some(function(account){
      if(account.ownerFactionId!==player||account.kind!==kind)return false;
      return ['income','expense'].some(function(phase){
        var frontier=(native.fiscalFrontier||{})[phase+':'+account.id];
        return typeof frontier==='number'||Object.keys(native.fiscalOperations||{}).some(function(key){var receipt=native.fiscalOperations[key];return key.indexOf(phase+':')===0&&receipt&&receipt.accountId===account.id;});
      });
    });
    return nativeActual||a.flowBasis==='actual'||marker._lastFixedExpenseTurn===turn||marker._lastCascadeTaxTurn===turn||marker._lastCascadeTurn===turn||marker._lastCascadeTurn===turn-1||RES.some(function(k){var l=(a.ledgers||{})[k]||{};return num(l.thisTurnIn)!==0||num(l.thisTurnOut)!==0;});
  }
  function hasActualLedger(o){
    var a=o.account||{};
    return flowIsActual(o)&&RES.some(function(k){var l=(a.ledgers||{})[k]||{};return ['thisTurnIn','thisTurnOut'].some(function(f){return typeof l[f]==='number'&&isFinite(l[f]);});});
  }
  function actualFlow(ledger,planned,scope){
    var raw=ledger||{},result={sources:{},sinks:{},sourceDetails:{},sinkDetails:{},income:num(raw.thisTurnIn),expense:num(raw.thisTurnOut)};
    ['sources','sinks'].forEach(function(side){
      var incoming=side==='sources',direction=incoming?'in':'out',details=incoming?'sourceDetails':'sinkDetails',total=incoming?result.income:result.expense;
      if(!total)return;
      var groups={},originals={};
      Object.keys(raw[side]||{}).forEach(function(name){
        if(/_欠$/.test(name))return;var value=num(raw[side][name]);if(!value)return;
        var key=keyFor(name,scope,direction);add(groups,key,value);detail(originals,key,name,labels(scope,direction)[name]||name,value);
      });
      Object.keys(groups).forEach(function(key){
        var value=groups[key],label=incoming?key:labels(scope,direction)[key],recorded=(raw[details]||{})[key]||[],sum=recorded.reduce(function(n,r){return n+num(r.amount);},0);result[side][label]=value;
        if(sum>0&&sum<=value+.00001){
          recorded.forEach(function(r){detail(result[details],key,r.id,r.name,r.amount);});
          if(value-sum>.00001)detail(result[details],key,'unitemized:'+key,'其余'+labels(scope,direction)[key]+'凭据',round(value-sum));
        }else (originals[key]||[]).forEach(function(r){detail(result[details],key,r.id,r.name,r.amount);});
      });
    });
    return result;
  }
  function legacyStatement(o){
    var a=o.account||{},view=Object.assign({},a),scope=o.scope||'central',sources={},expenses={};
    var actual=hasActualLedger(o),forecast=!actual,recorded=a.accounting||a.period||{};
    var days=(actual&&num(recorded.days))||num(a.turnDays)||num(o.turnDays)||30,year=num(recorded.daysPerYear)||(scope==='internal'?360:365);
    view.flowBasis=actual?'actual':'forecast';view.turnDays=days;
    view.ledgers={};
    RES.forEach(function(k){
      var raw=(a.ledgers||{})[k]||{},led=Object.assign({},raw),suffix=k==='money'?'':k.charAt(0).toUpperCase()+k.slice(1);
      sources[k]={};expenses[k]={};
      if(forecast){
        led.thisTurnIn=a['turn'+suffix+'Income']!=null?a['turn'+suffix+'Income']:num(a['monthly'+suffix+'Income'])*days/30;
        led.thisTurnOut=a['turn'+suffix+'Expense']!=null?a['turn'+suffix+'Expense']:num(a['monthly'+suffix+'Expense'])*days/30;
        [['in','sources','sourceDetails',led.thisTurnIn,sources[k]],['out','sinks','sinkDetails',led.thisTurnOut,expenses[k]]].forEach(function(p){
          var bag=k==='money'?a[p[1]==='sources'?'sources':'expenses']||{}:{},total=Object.keys(bag).reduce(function(n,key){return n+num(bag[key]);},0),annual=a['annual'+suffix+(p[0]==='in'?'Income':'Expense')];
          var key=scope==='internal'?'other':'qita',values={},details={},ratio=p[3]>0&&annual>0?annual/p[3]:year/days;
          if(total>0&&Math.abs(total-num(annual))<.01)Object.keys(bag).forEach(function(id){var v=num(bag[id])/ratio;add(values,p[0]==='in'?id:labels(scope,'out')[id]||id,v);detail(details,id,id,labels(scope,p[0])[id]||id,v);});
          else if(p[3]){values[p[0]==='in'?key:labels(scope,'out')[key]]=p[3];detail(details,key,'unitemized','尚待具分目',p[3]);}
          led[p[1]]=values;led[p[2]]=details;
          Object.keys(details).forEach(function(id){p[4][id]=details[id].map(function(r){return Object.assign({},r,{amount:round(r.amount*ratio)});});});
        });
      }
      if(actual){
        [['thisTurnIn','Income','sources','sourceDetails'],['thisTurnOut','Expense','sinks','sinkDetails']].forEach(function(p){
          if(typeof raw[p[0]]!=='number'||!isFinite(raw[p[0]])){
            led[p[0]]=null;led[p[2]]={};led[p[3]]={};
            ['turn','monthly','annual'].forEach(function(prefix){view[prefix+suffix+p[1]]=null;});return;
          }
          var value=raw[p[0]];view['turn'+suffix+p[1]]=value;view['monthly'+suffix+p[1]]=round(value*30/days);view['annual'+suffix+p[1]]=round(value*year/days);
          if(value===0){led[p[2]]={};led[p[3]]={};}
        });
      }else{
        view['turn'+suffix+'Income']=led.thisTurnIn;view['turn'+suffix+'Expense']=led.thisTurnOut;
      }
      if(typeof raw.stock==='number'&&isFinite(raw.stock)){view[k]=raw.stock;if(k==='money')view.balance=raw.stock;}
      view.ledgers[k]=led;
    });
    view.lastDelta=view.turnIncome===null||view.turnExpense===null?null:num(view.turnIncome)-num(view.turnExpense);
    var periodTurn=recorded.turn!=null?recorded.turn:(o.game||{})._lastCascadeTurn;
    var status=actual&&periodTurn!=null&&periodTurn<(o.game||{}).turn?'previous':'current';
    return {account:view,forecast:forecast,periodStatus:status,unit:view.unit,budget:null,sourceDetailsByResource:sources,expenseDetailsByResource:expenses};
  }
  function read(o){
    o=o||{};var account=o.account||{},budget=o.budget,scope=o.scope||'central';
    if(!budget)return legacyStatement(o);
    var actual=flowIsActual(o),period=actual&&(account.accounting||account.period)||budget.period,days=num(period.days)||budget.period.days,year=budget.period.daysPerYear;
    var planned=budgetFlows(budget,scope),view=Object.assign({},account),sourceDetails={},expenseDetails={};
    view.ledgers={};view.sources={};view.expenses={};view.sourcesDetail={};view.expensesDetail={};
    Object.keys(labels(scope,'in')).forEach(function(k){view.sources[k]=0;});Object.keys(labels(scope,'out')).forEach(function(k){view.expenses[k]=0;});
    RES.forEach(function(k){
      var raw=(account.ledgers||{})[k]||{},flow=actual?actualFlow(raw,planned[k],scope):planned[k],suffix=k==='money'?'':k.charAt(0).toUpperCase()+k.slice(1);
      view.ledgers[k]=Object.assign({},raw,{stock:raw.stock!=null?raw.stock:num(account[k]),sources:flow.sources,sinks:flow.sinks,sourceDetails:flow.sourceDetails,sinkDetails:flow.sinkDetails,thisTurnIn:flow.income,thisTurnOut:flow.expense});
      view[k]=view.ledgers[k].stock;if(k==='money')view.balance=view[k];
      view['turn'+suffix+'Income']=flow.income;view['turn'+suffix+'Expense']=flow.expense;
      view['monthly'+suffix+'Income']=round(flow.income*30/days);view['monthly'+suffix+'Expense']=round(flow.expense*30/days);
      view['annual'+suffix+'Income']=round(flow.income*year/days);view['annual'+suffix+'Expense']=round(flow.expense*year/days);
      function annualDetails(rows){var out={};Object.keys(rows).forEach(function(key){out[key]=rows[key].map(function(r){return Object.assign({},r,{amount:round(r.amount*year/days)});});});return out;}
      sourceDetails[k]=annualDetails(flow.sourceDetails);expenseDetails[k]=annualDetails(flow.sinkDetails);
      if(k==='money'){
        Object.keys(flow.sources).forEach(function(key){view.sources[key]=round(flow.sources[key]*year/days);});
        Object.keys(flow.sinks).forEach(function(label){view.expenses[keyFor(label,scope,'out')]=round(flow.sinks[label]*year/days);});
        [['sourcesDetail',flow.sourceDetails],['expensesDetail',flow.sinkDetails]].forEach(function(pair){Object.keys(pair[1]).forEach(function(key){view[pair[0]][key]=pair[1][key].map(function(r){return Object.assign({},r,{amount:round(r.amount*year/days)});});});});
      }
    });
    view.turnDays=days;view.unit=clone(budget.period.unit);view.lastDelta=round(view.turnIncome-view.turnExpense);view.flowBasis=actual?'actual':'forecast';view.accounting=clone(period);
    var status=actual&&o.game&&period.turn!=null&&period.turn<o.game.turn?'previous':'current';
    return {account:view,forecast:!actual,periodStatus:status,unit:view.unit,budget:budget,sourceDetailsByResource:sourceDetails,expenseDetailsByResource:expenseDetails};
  }
  function sync(o){
    var result=read(o),a=o.account,v=result.account;
    if(!o.budget){
      if(v.flowBasis)a.flowBasis=v.flowBasis;if(v.turnDays>0)a.turnDays=v.turnDays;
      if(!result.forecast){
        RES.forEach(function(k){var l=(a.ledgers||{})[k]||{},suffix=k==='money'?'':k.charAt(0).toUpperCase()+k.slice(1);[['thisTurnIn','Income'],['thisTurnOut','Expense']].forEach(function(pair){
          ['turn','monthly','annual'].forEach(function(p){var key=p+suffix+pair[1];a[key]=v[key];});
        });});a.lastDelta=v.lastDelta;
      }
      return result;
    }
    ['unit','turnDays','lastDelta','flowBasis','accounting','sources','expenses','sourcesDetail','expensesDetail'].forEach(function(k){a[k]=clone(v[k]);});
    RES.forEach(function(k){var suffix=k==='money'?'':k.charAt(0).toUpperCase()+k.slice(1);['turn','monthly','annual'].forEach(function(p){['Income','Expense'].forEach(function(d){var key=p+suffix+d;a[key]=v[key];});});});
    return result;
  }
  function fixedSummary(budget){
    var flows=budgetFlows(budget,'central'),salary=zero(),army=zero(),royal=zero();
    RES.forEach(function(k){salary[k]=num(flows[k].sinks['俸禄']);army[k]=num(flows[k].sinks['军饷']);});
    return {salary:salary,army:army,royal:royal,imperial:clone(budget.expenses.internal),administration:clone(budget.expenses.administration),recurring:clone(budget.expenses.recurring),local:clone(budget.expenses.local),totalMoney:budget.expenses.central.money,totalGrain:budget.expenses.central.grain,totalCloth:budget.expenses.central.cloth,turnDays:budget.period.days};
  }
  function collectionZero(){return {extraCollected:0,withheldByAgent:{clerk:0,official:0,power:0,unallocated:0},notCollected:{resistance:0,other:0,assessmentReduction:0,assessmentIncrease:0}};}
  function collectionTax(o){
    var out=collectionZero(),cfg=o.config||{},shares=cfg.withholdingShares||{official:1},total=0;
    ['clerk','official','power'].forEach(function(k){var v=shares[k]==null?0:Number(shares[k]);if(!isFinite(v)||v<0||v>1)throw Error('invalid collection withholding share:'+k);total+=v;out.withheldByAgent[k]=round(o.skimmed*v);});
    if(total>1.00000001)throw Error('collection withholding shares exceed one');
    var extra=cfg.extraRate==null?0:Number(cfg.extraRate),resist=cfg.resistanceShare==null?0:Number(cfg.resistanceShare);
    if(!isFinite(extra)||extra<0||extra>1||!isFinite(resist)||resist<0||resist>1)throw Error('collection rates must be ratios from zero to one');
    out.extraCollected=round(o.collected*extra);out.withheldByAgent.clerk=round(out.withheldByAgent.clerk+out.extraCollected);
    out.withheldByAgent.unallocated=round(Math.max(0,o.skimmed*(1-total)));
    var unpaid=Math.max(0,round(o.eligible-o.collected));out.notCollected.resistance=round(unpaid*resist);out.notCollected.other=round(unpaid-out.notCollected.resistance);
    out.notCollected.assessmentReduction=Math.max(0,round(o.nominal-o.eligible));out.notCollected.assessmentIncrease=Math.max(0,round(o.eligible-o.nominal));return out;
  }
  function addCollection(to,from){Object.keys(to).forEach(function(k){if(to[k]&&typeof to[k]==='object')addCollection(to[k],from[k]||{});else to[k]=round(num(to[k])+num(from[k]));});return to;}
  function taxThree(summary,resource){
    resource=resource||'money';var nominal=num(summary.nominal&&summary.nominal[resource]),gross=num(summary.grossCollected&&summary.grossCollected[resource]),received=num(summary.central&&summary.central[resource])+num(summary.localRetain&&summary.localRetain[resource]),skim=num(summary.skimmed&&summary.skimmed[resource]),transit=num(summary.lostTransit&&summary.lostTransit[resource]);
    var detail=summary.collection&&summary.collection[resource],parts=detail?detail.withheldByAgent:{clerk:0,official:skim,power:0,unallocated:0},extra=detail?num(detail.extraCollected):0,paid=round(gross+extra);
    return {nominal:nominal,actualReceived:received,peasantPaid:paid,regularPaid:gross,extraCollected:extra,totalLoss:Math.max(0,round(paid-received)),leakageRate:nominal>0?Math.max(0,1-received/nominal):0,overCollectRate:gross>0?extra/gross:0,gaps:{clerk:num(parts.clerk),official:num(parts.official),power:num(parts.power),unallocated:num(parts.unallocated),transit:transit},notCollected:detail?clone(detail.notCollected):null,governmentScope:'central-and-regional',resource:resource,collectionDeclared:!!detail,_source:'cascade'};
  }
  function contextAccount(statement){
    var a=statement.account,summary={known:true,periodStatus:statement.periodStatus||'current'};
    ['unit','flowBasis','turnDays','accounting','money','grain','cloth','turnIncome','turnExpense','turnGrainIncome','turnGrainExpense','turnClothIncome','turnClothExpense','monthlyIncome','monthlyExpense','annualIncome','annualExpense','sources','expenses'].forEach(function(k){if(a[k]!=null)summary[k]=clone(a[k]);});
    if(summary.money==null&&a.balance!=null)summary.money=a.balance;
    summary.resources={};RES.forEach(function(k){var led=(a.ledgers||{})[k]||{};summary.resources[k]={stock:led.stock!=null?led.stock:a[k],income:led.thisTurnIn,expense:led.thisTurnOut,sources:clone(led.sources||{}),sinks:clone(led.sinks||{}),deficit:num(led.deficit),deficitDetails:clone(led.deficitDetails||{})};});
    return summary;
  }
  // 显式物量与价率的纯计算；未声明的旧税表不调用，零/缺项不改成人口税基。
  function productionTaxBase(div, tax) {
    if (tax.enabled === false) return 0;
    var ids = tax.productionTax.regionIds;
    if (Array.isArray(ids) && ids.indexOf(div.id) < 0) return 0;
    return Math.max(0, num(div.economyBase && div.economyBase[tax.base]));
  }
  function productionTaxAmount(amount, production) {
    return amount * Math.max(0, num(production.unitPrice) - Math.max(0, num(production.unitCost)));
  }
  // 只汇总征收引擎给出的分税报价；不再次取价、抽分、扣损或折算粮布。
  function taxRevenuePreview(nodes, quote, period) {
    var totals = {nominal:zero(), central:zero(), localRetain:zero(), collected:zero()};
    var regions = nodes.map(function(node) {
      var rows = quote(node).filter(function(t) { return t && RES.indexOf(t.resource) >= 0; });
      rows.forEach(function(t) {
        totals.nominal[t.resource] += num(t.nominal); totals.central[t.resource] += num(t.central);
        totals.localRetain[t.resource] += num(t.local); totals.collected[t.resource] += num(t.collected);
      });
      return {id:node.id, name:node.name, taxes:rows};
    });
    return Object.assign({regions:regions, totals:totals}, period);
  }
  // 方志与旧国库兜底共用征收函数；只在副本上演算，不写库存、自然率或回合标记。
  function previewRevenue(opts, helpers) {
    var getGame = helpers.getGame, getFiscalConfig = helpers.getFiscalConfig, unifiedAccounting = helpers.unifiedAccounting, safeNumber = helpers.safeNumber;
    var normalizeTaxListForCascade = helpers.normalizeTaxListForCascade, ownedBudgetDivisions = helpers.ownedBudgetDivisions, budgetFaction = helpers.budgetFaction, walkAdminDivisions = helpers.walkAdminDivisions;
    var budgetRevenue = helpers.budgetRevenue, DEFAULT_ALLOCATION = helpers.DEFAULT_ALLOCATION, DEFAULT_LOGISTICS_LOSS = helpers.DEFAULT_LOGISTICS_LOSS, clone = helpers.clone;
    var applyDisasterEconomyReduction = helpers.applyDisasterEconomyReduction, _ensureRegionFiscal = helpers._ensureRegionFiscal, _settleLandFlow = helpers._settleLandFlow, rawTaxAmount = helpers.rawTaxAmount;
    var computeTaxAmount = helpers.computeTaxAmount, splitCascadeAmount = helpers.splitCascadeAmount, taxBase = helpers.taxBase;
    opts = opts || {};
    var G = getGame(opts.game), cfg = getFiscalConfig(G, opts.faction);
    if (!G || (global.TM && global.TM.NativeFiscal && global.TM.NativeFiscal.enabled(G))) return null;
    var unified = unifiedAccounting(G, opts.faction), year = unified ? 360 : 365;
    var days = safeNumber(opts.turnDays, year), taxes = normalizeTaxListForCascade(G, cfg), nodes = [];
    if (opts.division) {
      (function visit(d) { if (d.children && d.children.length) d.children.forEach(visit); else nodes.push(d); })(opts.division);
    }
    else if (unified) nodes = ownedBudgetDivisions(G, budgetFaction(G, opts.faction));
    else walkAdminDivisions(G, function(d) { nodes.push(d); }, { faction:opts.faction || 'player', leafOnly:true });
    if (unified) {
      var budget = budgetRevenue(G, budgetFaction(G, opts.faction), cfg, days, nodes);
      budget.totals.collected = budget.totals.grossCollected;
      return Object.assign(budget, {daysPerYear:year, turnDays:days});
    }
    var ctx = { game:G, fiscalConfig:cfg, turnDays:days,
      turnFracOfYear:Math.max(0.01, Math.min(1, days/year)),
      centralLocalRules:cfg.centralLocalRules || DEFAULT_ALLOCATION,
      logisticsLoss:safeNumber(cfg.logisticsLoss, DEFAULT_LOGISTICS_LOSS) };
    var parents = {};
    walkAdminDivisions(G, function(d, parent) { if (parent) parents[d.id || d.name] = parent; }, {leafOnly:true});
    return global.FiscalStatement.taxRevenuePreview(nodes, function(node) {
      var div = clone(node);
      var parent = parents[node.id || node.name];
      var tree = parent ? {id:parent.id, name:parent.name, children:[div]} : div;
      applyDisasterEconomyReduction(Object.assign({}, G, {adminHierarchy:{player:{divisions:[tree]}}}));
      _ensureRegionFiscal(div, null);
      if (opts.settleProduction !== false) _settleLandFlow(div, ctx);
      return taxes.map(function(original) {
        var tax = original;
        if (global.TM && global.TM.TaxPolicy) tax = global.TM.TaxPolicy.effectiveTax(G, div, tax, ctx);
        var kind = tax.storeAs || 'money', adjust = Number(cfg.annualFuyi && cfg.annualFuyi.taxRateAdjust);
        var fuyi = tax.annual && isFinite(adjust) ? 1 + Math.max(-0.5, Math.min(0.5, adjust)) : 1;
        var nominal = rawTaxAmount(div, tax) * (tax.annual ? ctx.turnFracOfYear : 1) * fuyi;
        var collected = computeTaxAmount(div, original, ctx);
        var split = splitCascadeAmount(div, original, collected, ctx);
        return { id:tax.id, name:tax.name || tax.id, sourceTag:tax.sourceTag || tax.id, resource:kind,
          base:tax.base, baseValue:taxBase(div,tax), productionTax:tax.productionTax || null, taxBasePolicy:tax.taxBasePolicy || '', nominal:Math.max(0, nominal),
          collected:collected, central:split.toCentral, local:split.cunliu, skimmed:split.skimmed, transit:split.lostInTransit };
      });
    }, {daysPerYear:year, turnDays:days});
  }

  global.FiscalStatement={previewRevenue:previewRevenue,productionTaxBase:productionTaxBase,productionTaxAmount:productionTaxAmount,taxRevenuePreview:taxRevenuePreview,read:read,sync:sync,flowIsActual:flowIsActual,hasActualLedger:hasActualLedger,expenseKey:expenseKey,expenseLabel:expenseLabel,flowTag:flowTag,recordExpense:recordExpense,recordFlow:recordFlow,repayDeficits:repayDeficits,collectionZero:collectionZero,collectionTax:collectionTax,addCollection:addCollection,budgetFlows:budgetFlows,fixedSummary:fixedSummary,taxThree:taxThree,labels:labels,contextAccount:contextAccount};
})(typeof window!=='undefined'?window:globalThis);
