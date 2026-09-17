'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'smoke-treasury-account-books.js'),'utf8').replace(/^#![^\n]*\n/,''),end=source.indexOf('let {c,scenario,elements}=fixture()');
assert(end>0);const fixture=new Function('require','__dirname',source.slice(0,end)+'\nreturn fixture;')(require,__dirname);
const R=['money','grain','cloth'];let checks=0;
const ok=(v,m)=>{assert(v,m);checks++;},near=(a,b,m)=>ok(Math.abs(a-b)<.001,m+': '+a+' / '+b),sum=o=>Object.values(o||{}).reduce((a,v)=>a+v,0);
function setup(){
 const f=fixture(),c=f.c,G=c.GM,cfg=G.facs[0].fiscalConfig;
 cfg.fixedExpense.includeNamedOfficeSalaries=true;
 cfg.fixedExpense.administrativeStaff=[{id:'staff',name:'同名给用',count:2,monthlyPay:{money:30,grain:2,cloth:.2},funding:'central',sourceTag:'fenglu'}];
 cfg.fixedExpense.recurringExpenses.push({id:'first-work',name:'同名给用',monthly:{money:24,grain:3,cloth:.3},funding:'central',sourceTag:'gongcheng'});
 G.officeTree=[{name:'百司',positions:[{id:'official',name:'在职官员',holder:'李瀍',holderId:'emperor',salary:9,monthlyPay:{money:9,grain:1,cloth:.1},salaryHeadcount:1,fiscalFunding:'central'}]}];
 G.armies=[{id:'guard',name:'宿卫军',faction:'唐',soldiers:30,monthlyMoneyPayPerSoldier:2,monthlyGrainPayPerSoldier:1,monthlyClothPayPerSoldier:.1,funding:{localShare:.25,regionId:'A'},sourceTag:'junxiang'}];
 G.fiscalConfig=JSON.parse(JSON.stringify(cfg));return f;
}
{
 const {c}=setup(),G=c.GM,stock=JSON.stringify([G.guoku.ledgers,G.neitang.ledgers]),b=c.CascadeTax.previewBudget({turnDays:10});
 c.CascadeTax.applyBudgetSnapshot({game:G,budget:b});
 ok(JSON.stringify([G.guoku.ledgers,G.neitang.ledgers])===stock,'initial statement never posts forecast money or resets true ledgers');
 ok(G.guoku.flowBasis==='forecast'&&G.neitang.flowBasis==='forecast','same forecast field for both funds');
 near(G.guoku.expenses.fenglu/36,(60+9)/3,'full payroll uses existing annual fenglu key');
 near(G.guoku.expenses.junxiang/36,45/3,'military category includes only central share');
 near(G.neitang.sources.guokuTransfer/12,300,'inner recurring receipt has common annual source field');
 near(G.neitang.expenses.gongting/12,300,'inner recurring expense has common annual expense field');
 for(const name of ['guoku','neitang']){
  const scope=name==='guoku'?'central':'internal',a=G[name],view=c.FiscalEngine.readAccountStatement({game:G,account:a,budget:b,scope,actual:false});
  near(sum(a.sources),a.annualIncome,'annual income categories reconcile '+name);near(sum(a.expenses),a.annualExpense,'annual expense categories reconcile '+name);
  for(const k of R){const l=view.account.ledgers[k];near(sum(l.sources),l.thisTurnIn,'period sources reconcile '+name+'/'+k);near(sum(l.sinks),l.thisTurnOut,'period sinks reconcile '+name+'/'+k);near(Object.values(l.sourceDetails).flat().reduce((n,r)=>n+r.amount,0),l.thisTurnIn,'source detail keeps period '+name+'/'+k);near(Object.values(l.sinkDetails).flat().reduce((n,r)=>n+r.amount,0),l.thisTurnOut,'expense detail keeps period '+name+'/'+k);}
  near(Object.values(view.expenseDetailsByResource.money).flat().reduce((n,r)=>n+r.amount,0),a.annualExpense,'all annual Detail fields agree '+name);
 }
 const context=c.FiscalEngine.readFiscalContext({game:G});ok(context.guoku.expenses.junxiang>0&&context.guoku.expenses.fenglu>0,'AI receives canonical expense keys');near(context.neitang.turnIncome,100,'AI inner forecast not empty');
 const publicSalary=c.FiscalEngine.calcSalary({turnDays:10}),preview=c.FixedExpense.preview({turnDays:10});near(publicSalary.total.money,23,'public salary reader includes civil staff');near(preview.salary.money,23,'fixed preview salary matches reader');near(preview.army.money,15,'fixed preview excludes locally funded military share');
}
{
 const {c}=setup(),G=c.GM,centralBefore=G.guoku.money,innerBefore=G.neitang.money;
 c.CascadeTax.collect({turnDays:10});const paid=c.FixedExpense.collect({turnDays:10});
 near(G.guoku.money-centralBefore,G.guoku.ledgers.money.thisTurnIn-G.guoku.ledgers.money.thisTurnOut,'actual central stock reconciles');near(G.neitang.money-innerBefore,G.neitang.ledgers.money.thisTurnIn-G.neitang.ledgers.money.thisTurnOut,'actual palace stock reconciles');
 near(G.guoku.expenses.fenglu/36,paid.turnExpense.salary.money,'full actual payroll recorded');near(G.guoku.expenses.junxiang/36,paid.turnExpense.army.money,'actual central military payment recorded');
 ok(G.guoku.ledgers.money.sinks['俸禄']>0&&G.guoku.ledgers.money.sinks['军饷']>0,'true ledger uses common official sink names');
 for(const name of ['guoku','neitang'])for(const k of R){const l=G[name].ledgers[k];near(sum(l.sources),l.thisTurnIn,'raw posted sources reconcile '+name+'/'+k);near(sum(l.sinks),l.thisTurnOut,'raw posted sinks reconcile '+name+'/'+k);}
 let view=c.FiscalEngine.readAccountStatement({game:G,account:G.guoku});
 near(view.account.ledgers.money.sinkDetails.fenglu.find(r=>r.name==='同名给用').amount,20,'same display name keeps payroll in payroll');near(view.account.ledgers.money.sinkDetails.gongcheng.find(r=>r.name==='同名给用').amount,8,'same display name keeps works in works');
 G.turn++;c._getDaysPerTurn=()=>30;G.facs[0].fiscalConfig.fixedExpense.administrativeStaff=[];
 view=c.FiscalEngine.readAccountStatement({game:G,account:G.guoku});near(view.account.turnDays,10,'recorded period survives new turn length');near(view.account.ledgers.money.sinks['俸禄'],23,'changing next budget cannot rewrite actual payroll');
 c.GuokuEngine.monthlySettle(1/3);near(G.guoku.expenses.fenglu,23*36,'archive preserves annual category meaning after turn increment');
 const frozen=JSON.stringify(G);c.FiscalEngine.readFiscalContext({game:G});ok(JSON.stringify(G)===frozen,'AI summary cannot mutate any account');
}
{
 const {c}=setup(),G=c.GM;for(const n of ['guoku','neitang'])for(const k of R){G[n][k]=0;G[n].ledgers[k].stock=0;}G.guoku.balance=0;G.neitang.balance=0;
 const paid=c.FixedExpense.collect({turnDays:10});ok(paid.deficit.money>0,'unpaid obligations are retained');
 const v=c.FiscalEngine.readAccountStatement({game:G,account:G.guoku});near(v.account.turnExpense,0,'empty treasury posts no imaginary payment');near(sum(v.account.expenses),0,'due amounts are not put in paid categories');
 for(const k of R)near(sum(v.account.ledgers[k].sinks),0,'arrears are excluded from actual outflow '+k);
 ok(!v.forecast,'zero settled flow never becomes estimate');
}
{
 const {c}=setup(),G=c.GM,snapshot=JSON.stringify(G),summary={nominal:{money:100},grossCollected:{money:80},central:{money:40},localRetain:{money:20},skimmed:{money:15},lostTransit:{money:5}};
 const flow=c.FiscalStatement.taxThree(summary);near(sum(flow.gaps),flow.totalLoss,'all shortfall categories sum exactly');near(flow.gaps.power,0,'transport loss does not claim powerful household diversion');near(flow.gaps.transit,5,'transport loss has its own shared key');ok(JSON.stringify(G)===snapshot,'tax explanation is pure');
}
{
 const {c}=setup(),G=c.GM;
 G.guoku.extraIncome=[{id:'new-salt',name:'增订盐课',category:'yanlizhuan',amount:3600,resource:'money',recurring:true}];
 G.guoku.extraExpense=[{id:'new-guard',name:'新定军费',category:'junxiang',amount:1440,resource:'money',recurring:true}];
 G.neitang.extraIncome=[{id:'new-tribute',name:'贡院常进',category:'tribute',amount:720,resource:'money',recurring:true}];
 G.neitang.extraExpense=[{id:'new-palace',name:'宫中常供',category:'gongting',amount:360,resource:'money',recurring:true},
   {id:'new-rice',name:'供膳粮',category:'gongting',amount:72,resource:'grain',recurring:true},
   {id:'new-cloth',name:'宫衣料',category:'gongting',amount:36,resource:'cloth',recurring:true}];
 const guokuBefore=G.guoku.money,innerBefore=G.neitang.money;
 c.GuokuEngine.monthlySettle(1/3);c.NeitangEngine.monthlySettle(1/3);
 near(G.guoku.money,guokuBefore+100-40,'recurring central owner posts actual money');
 near(G.neitang.money,innerBefore+20-10,'recurring palace owner posts actual money');
 near(G.guoku.sources.yanlizhuan,3600,'recurring central income keeps annual category');
 near(G.guoku.expenses.junxiang,1440,'recurring army cost keeps annual category');
 near(G.neitang.sources.tribute,720,'recurring palace receipt keeps annual category');
 near(G.neitang.expenses.gongting,360,'recurring palace expense keeps annual category');
 near(G.guoku.ledgers.money.sources.yanlizhuan,100,'actual recurring source uses standard key');
 near(G.guoku.ledgers.money.sinks['军饷'],40,'actual recurring army expense uses standard label');
 near(G.neitang.ledgers.money.sinks['宫廷'],10,'actual recurring palace expense uses standard label');
 for(const [fund,resource,key,id,amount] of [['guoku','money','junxiang','new-guard',40],['neitang','money','gongting','new-palace',10],['neitang','grain','gongting','new-rice',2],['neitang','cloth','gongting','new-cloth',1]]){
  const ledger=G[fund].ledgers[resource];near(ledger.sinkDetails[key].find(r=>r.id===id).amount,amount,'recurring detail preserves identity '+id);
  near(sum(ledger.sinks),ledger.thisTurnOut,'recurring category sum reconciles '+id);
 }
 near(G.guoku.ledgers.money.sourceDetails.yanlizhuan.find(r=>r.id==='new-salt').amount,100,'recurring salt keeps source ID');
 near(G.neitang.ledgers.money.sourceDetails.tribute.find(r=>r.id==='new-tribute').amount,20,'recurring tribute keeps source ID');
 const before=JSON.stringify([G.guoku.ledgers,G.neitang.ledgers]);
 c.GuokuEngine.monthlySettle(1/3);c.NeitangEngine.monthlySettle(1/3);
 ok(JSON.stringify([G.guoku.ledgers,G.neitang.ledgers])===before,'repeated recurring settlement does not duplicate flows or details');
}
{
 const {c}=setup(),n=c.GM.neitang;n.money=n.balance=n.ledgers.money.stock=2;
 n.extraExpense=[{id:'palace-short',name:'未足常供',category:'gongting',amount:360,resource:'money',recurring:true}];
 c.NeitangEngine.monthlySettle(1/3);
 near(n.ledgers.money.thisTurnOut,2,'palace recurring payment cannot exceed stock');
 near(n.ledgers.money.deficit,8,'palace recurring shortfall remains unpaid');
 near(n.ledgers.money.deficitDetails.gongting.find(r=>r.id==='palace-short').amount,8,'recurring shortfall uses same expense identity');
 near(n.expenses.gongting,72,'only paid recurring amount is annualized');
}
console.log('[smoke-fiscal-field-contracts] PASS '+checks+' assertions');
