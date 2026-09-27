'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
function edit(file,fn){const target=path.join(root,file),raw=fs.readFileSync(target),source=raw.toString('utf8'),backup=path.join(__dirname,'backups',file+'.bak');fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.writeFileSync(backup,raw);const next=fn(source);if(next===source)throw Error('unchanged '+file);fs.writeFileSync(target,next);}
function one(s,a,b){if(s.split(a).length!==2)throw Error('unique replacement missing: '+a.slice(0,90));return s.replace(a,b);}
edit('web/tm-fiscal-statements.js',s=>{
 s=one(s,"marker._lastFixedExpenseTurn===turn||marker._lastCascadeTaxTurn===turn||RES.some", "marker._lastFixedExpenseTurn===turn||marker._lastCascadeTaxTurn===turn||marker._lastCascadeTurn===turn||marker._lastCascadeTurn===turn-1||RES.some");
 s=one(s,'  function actualFlow(ledger,planned,scope){',`  function hasActualLedger(o){
    var a=o.account||{};
    return flowIsActual(o)&&RES.some(function(k){var l=(a.ledgers||{})[k]||{};return ['thisTurnIn','thisTurnOut'].some(function(f){return typeof l[f]==='number'&&isFinite(l[f]);});});
  }
  function actualFlow(ledger,planned,scope){`);
 s=one(s,`    if(o.actual!=null)view.flowBasis=o.actual?'actual':'forecast';
    if(o.turnDays>0)view.turnDays=o.turnDays;
    var forecast=view.flowBasis==='forecast',days=view.turnDays||30,year=scope==='internal'?360:365;`, `    var actual=hasActualLedger(o),forecast=!actual,recorded=a.accounting||a.period||{};
    var days=(actual&&num(recorded.days))||num(a.turnDays)||num(o.turnDays)||30,year=num(recorded.daysPerYear)||(scope==='internal'?360:365);
    view.flowBasis=actual?'actual':'forecast';view.turnDays=days;`);
 s=one(s,'      view.ledgers[k]=led;\n    });\n    return {account:view,forecast:forecast,unit:view.unit,budget:null,sourceDetailsByResource:sources,expenseDetailsByResource:expenses};',`      if(actual){
        [['thisTurnIn','Income','sources','sourceDetails'],['thisTurnOut','Expense','sinks','sinkDetails']].forEach(function(p){
          if(typeof raw[p[0]]!=='number'||!isFinite(raw[p[0]]))return;
          var value=raw[p[0]];view['turn'+suffix+p[1]]=value;view['monthly'+suffix+p[1]]=round(value*30/days);view['annual'+suffix+p[1]]=round(value*year/days);
          if(value===0){led[p[2]]={};led[p[3]]={};}
        });
      }else{
        view['turn'+suffix+'Income']=led.thisTurnIn;view['turn'+suffix+'Expense']=led.thisTurnOut;
      }
      if(typeof raw.stock==='number'&&isFinite(raw.stock)){view[k]=raw.stock;if(k==='money')view.balance=raw.stock;}
      view.ledgers[k]=led;
    });
    view.lastDelta=num(view.turnIncome)-num(view.turnExpense);
    var periodTurn=recorded.turn!=null?recorded.turn:(o.game||{})._lastCascadeTurn;
    var status=actual&&periodTurn!=null&&periodTurn<(o.game||{}).turn?'previous':'current';
    return {account:view,forecast:forecast,periodStatus:status,unit:view.unit,budget:null,sourceDetailsByResource:sources,expenseDetailsByResource:expenses};`);
 s=one(s,"    if(!o.budget){if(v.flowBasis)a.flowBasis=v.flowBasis;if(v.turnDays>0)a.turnDays=v.turnDays;return result;}",`    if(!o.budget){
      if(v.flowBasis)a.flowBasis=v.flowBasis;if(v.turnDays>0)a.turnDays=v.turnDays;
      if(!result.forecast){
        RES.forEach(function(k){var l=(a.ledgers||{})[k]||{},suffix=k==='money'?'':k.charAt(0).toUpperCase()+k.slice(1);[['thisTurnIn','Income'],['thisTurnOut','Expense']].forEach(function(pair){
          if(typeof l[pair[0]]!=='number'||!isFinite(l[pair[0]]))return;
          ['turn','monthly','annual'].forEach(function(p){var key=p+suffix+pair[1];a[key]=v[key];});
        });});a.lastDelta=v.lastDelta;
      }
      return result;
    }`);
 return one(s,'flowIsActual:flowIsActual,expenseKey:', 'flowIsActual:flowIsActual,hasActualLedger:hasActualLedger,expenseKey:');
});
edit('web/tm-minxin-hard-link-consumers.js',s=>one(s,`    root.guoku = root.guoku && typeof root.guoku === 'object' ? root.guoku : {};
    root.fiscal = root.fiscal && typeof root.fiscal === 'object' ? root.fiscal : {};
    var hard = snapshot.summary && snapshot.summary.fiscal || {};`, `    root.guoku = root.guoku && typeof root.guoku === 'object' ? root.guoku : {};
    root.fiscal = root.fiscal && typeof root.fiscal === 'object' ? root.fiscal : {};
    var S=global.FiscalStatement,options={game:root,account:root.guoku,scope:'central'};
    if(S&&S.hasActualLedger&&S.hasActualLedger(options)){
      // The existing ledger owns cash flow; repair old display scalars without posting money.
      var settled=S.sync(options),account=settled.account;
      var recorded={turn:turn,plannedIncome:account.turnIncome,actualIncome:account.turnIncome,remittedIncome:account.turnIncome,flowBasis:'actual',periodDays:account.turnDays,source:'canonical-fiscal-ledger'};
      root.guoku.minxinConsumer=recorded;root.fiscal.minxinConsumer=clone(recorded);root.fiscal.effectiveRevenue=account.turnIncome;
      return clone(recorded);
    }
    var hard = snapshot.summary && snapshot.summary.fiscal || {};`));
edit('web/tm-guoku-panel.js',s=>{
 s=one(s,"  if (!explicit || !tax.previewBudget) return model;",`  if (!explicit || !tax.previewBudget) {
    if(typeof FiscalStatement!=='undefined'){
      var legacy=FiscalStatement.read({game:world,account:account,scope:'central'});
      model.account=legacy.account;model.forecast=legacy.forecast;model.periodStatus=legacy.periodStatus;model.unit=legacy.unit;
    }
    return model;
  }`.replace(/\n/g,'\r\n'));
 s=one(s,"    var ti = display.explicit ? (led.thisTurnIn || 0) : (led.thisTurnIn || 0) || (led.lastTurnIn || 0);", "    var ti = typeof led.thisTurnIn==='number' ? led.thisTurnIn : (led.lastTurnIn || 0);");
 return one(s,"    var to = display.explicit ? (led.thisTurnOut || 0) : (led.thisTurnOut || 0) || (led.lastTurnOut || 0);", "    var to = typeof led.thisTurnOut==='number' ? led.thisTurnOut : (led.lastTurnOut || 0);");
});
edit('web/phase8-formal-rightrail.js',s=>{
 s=one(s,'  function rightFinanceCascadeItems(kind){','  function rightFinanceCascadeItems(kind, account, forecast){');
 s=one(s,"    var g = gm.guoku || (window.P && P.guoku) || {};\n    var ledgers", "    var g = account || gm.guoku || (window.P && P.guoku) || {};\n    var ledgers");
 s=one(s,"amount: v, note: '本回合结算'", "amount: v, note: forecast ? '本期预计' : '本期交割'");
 s=one(s,"    if (kind !== 'expense') {\n      Object.keys(customStats)", "    if (kind !== 'expense' && !account) {\n      Object.keys(customStats)");
 s=one(s,`    var g = root.guoku || {};
    var n = root.neitang || {};`, `    var g = root.guoku || {};
    var statement = null;
    if(window.FiscalEngine && FiscalEngine.readAccountStatement) statement = FiscalEngine.readAccountStatement({game:window.GM || {},account:g,scope:'central'});
    else if(window.FiscalStatement) statement = FiscalStatement.read({game:window.GM || {},account:g,scope:'central'});
    if(statement) g = statement.account;
    var forecast = !!(statement && statement.forecast);
    var periodLabel = forecast ? '预计' : statement && statement.periodStatus === 'previous' ? '上期' : '本期';
    var periodNote = (forecast ? '预计' : '已交割') + ' · ' + (g.turnDays || 30) + '日';
    var n = root.neitang || {};`);
 s=one(s,"var income = rightFiscalReported('fiscal.turnIncome'", "var _rvIncome = rightFiscalReported('fiscal.turnIncome'");
 s=one(s,"['turnIncome','monthlyIncome','income'], 0)), 'good').shown;", "['turnIncome','monthlyIncome','income'], 0)), 'good');\n    var income = _rvIncome.shown;");
 s=one(s,"var expense = rightFiscalReported('fiscal.turnExpense'", "var _rvExpense = rightFiscalReported('fiscal.turnExpense'");
 s=one(s,"['turnExpense','monthlyExpense','expense'], 0)), 'bad').shown;", "['turnExpense','monthlyExpense','expense'], 0)), 'bad');\n    var expense = _rvExpense.shown;\n    var _rvFlowBadge = (window.TM && TM.ReportedView) ? TM.ReportedView.badge(_rvIncome.distorted ? _rvIncome : _rvExpense) : '';");
 s=one(s,"var _casIncome = rightFinanceCascadeItems('income');", "var _casIncome = rightFinanceCascadeItems('income', statement ? g : null, forecast);");
 s=one(s,"var _casExpense = rightFinanceCascadeItems('expense');", "var _casExpense = rightFinanceCascadeItems('expense', statement ? g : null, forecast);");
 s=one(s,"var incomeFromCascade = _casIncome.length > 0;", "var incomeFromCascade = !!statement || _casIncome.length > 0;");
 s=one(s,"var expenseFromCascade = _casExpense.length > 0;", "var expenseFromCascade = !!statement || _casExpense.length > 0;");
 s=one(s,"<span>本期结余</span>", "<span>' + esc(periodLabel) + '结余' + _rvFlowBadge + '</span>");
 s=one(s,"<span>本期收支</span><small>' + esc(getTurnText(window.GM && GM.turn))", "<span>' + esc(periodLabel) + '收支' + _rvFlowBadge + '</span><small>' + esc(periodNote)");
 s=one(s,"[['本期收入', rightFinanceMoney(income)], ['本期支出', rightFinanceMoney(expense)]", "[[periodLabel + '收入', rightFinanceMoney(income)], [periodLabel + '支出', rightFinanceMoney(expense)]");
 s=one(s,"incomeFromCascade ? '本回合级联结算'", "incomeFromCascade ? periodNote");
 return one(s,"expenseFromCascade ? '本回合级联结算'", "expenseFromCascade ? periodNote");
});
console.log('fiscal patch applied; original bytes backed up under',path.join(__dirname,'backups'));
