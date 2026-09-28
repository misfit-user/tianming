#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');let checks=0;
const clone=x=>JSON.parse(JSON.stringify(x));
const ok=(v,m)=>{assert(v,m);checks++;};
const near=(a,b,m)=>ok(Math.abs(a-b)<.00001,m+': '+a+' / '+b);
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
function installRail(c){
 const source=read('phase8-formal-rightrail.js');
 const names=['rightFinanceRoot','rightFinanceFirst','rightFinanceMoney','rightFinanceCollect','rightFinanceTagNames','rightFinanceResolveTagName','rightFinanceCascadeItems','rightFinanceItemList','rightFiscalReported','rightArmyRows','renderFinanceRich'];
 const functions=names.map(n=>{const m=source.match(new RegExp('  function '+n+'\\([^]*?\\n  \\}'));assert(m,n);return m[0];}).join('\n');
 vm.runInContext("var esc=x=>String(x==null?'':x);var attr=esc;var compactText=x=>String(x);var rightArmyFmtNum=x=>String(x);var rightAdminNum=(v,f)=>Number.isFinite(Number(v))?Number(v):f;var getTurnText=t=>'T'+t;"+functions,c);
}
function fixture(){
 const c={console,GM:{sid:'regression',turn:4,_lastCascadeTurn:3,guoku:{money:999999,balance:999999,stockMoney:888888,grain:9999,turnDays:10,turnIncome:17463000,monthlyIncome:17463000,annualIncome:999999999,turnExpense:2606000,ledgers:{money:{stock:95,thisTurnIn:300,thisTurnOut:400,sources:{tianfu:300},sinks:{军饷:400}},grain:{stock:0,thisTurnIn:0,thisTurnOut:0,lastTurnIn:99999,sources:{stale:99999}},cloth:{stock:7,thisTurnIn:0,thisTurnOut:0}}},_minxinHardLinks:{summary:{fiscal:{remittedToCenter:49738189,actualRevenue:71020955,collectionMultiplier:.59}}},corruption:{subDepts:{fiscal:{true:75}}}},P:{conf:{}},setTimeout(){},document:{getElementById(){return null;},querySelector(){return null;},addEventListener(){}}};
 c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-fiscal-statements.js','tm-minxin-hard-link-consumers.js','tm-guoku-panel.js','tm-reported-view.js'])vm.runInContext(read(f),c,{filename:f});
 installRail(c);return c;
}
function text(c,html,label){const m=html.match(new RegExp('<span>'+label+'</span><b>([^<]+)</b>'));return m&&m[1];}
{
 const c=fixture(),g=c.GM.guoku,before=JSON.stringify(c.GM),model=c._guokuReadDisplayModel(c.GM,g),html=c.renderFinanceRich();
 near(model.account.turnIncome,300,'legacy detail uses ledger instead of polluted income');
 near(model.account.turnExpense,400,'legacy detail uses actual expense');
 near(model.account.monthlyIncome,900,'ten-day actual normalizes monthly income once');
 near(model.account.annualIncome,10950,'legacy annual view respects its 365-day year');
 near(model.account.money,95,'inventory comes from the same ledger');
 ok(!model.forecast&&model.periodStatus==='previous','completed previous period is marked');
 ok(text(c,html,'上期收入')==='300'&&text(c,html,'上期支出')==='400','rail reads same period figures as detail');
 ok(html.includes('<b>-100</b><span>上期结余'),'rail net reconciles to ledger cash flow');
 ok(html.includes('<b>95</b><span>太仓银')&&!html.includes('stale'),'rail stock and zero resource rows have no old data');
 ok(html.includes('已交割 · 10日'),'rail labels recorded duration');
 ok(JSON.stringify(c.GM)===before,'reading contaminated save is side-effect free');
 const ledgerBefore=JSON.stringify(g.ledgers),stockBefore=g.money;
 const consumed=c.TM.MinxinHardLinkConsumers.consume(c.GM,{turn:4});
 near(g.turnIncome,300,'consumer repairs contaminated period income');
 near(g.monthlyIncome,900,'consumer repairs monthly scalar using period days');
 near(g.turnExpense,400,'consumer repairs expense scalar');
 near(g.lastDelta,-100,'consumer repairs net cash flow');
 ok(JSON.stringify(g.ledgers)===ledgerBefore&&g.money===stockBefore,'repair neither posts money nor mutates ledger');
 ok(consumed.summary.fiscal.source==='canonical-fiscal-ledger','unperiodized hard-link estimate does not replace actual receipts');
 c.TM.MinxinHardLinkConsumers.consume(c.GM,{turn:4});near(g.turnIncome,300,'repeat consume remains cash-idempotent');
}
{
 const c=fixture(),g=c.GM.guoku;g.ledgers.money.stock=0;g.ledgers.money.thisTurnIn=0;g.ledgers.money.thisTurnOut=0;g.ledgers.money.lastTurnIn=700;g.ledgers.money.lastTurnOut=800;g.ledgers.money.sources={stale:700};g.ledgers.money.sinks={stale:800};g._customTaxStats={stale:{turnAmount:5000,amount:60000,name:'旧税'}};
 const before=JSON.stringify(c.GM),model=c._guokuReadDisplayModel(c.GM,g),html=c.renderFinanceRich();
 near(model.account.turnIncome,0,'zero settled income never falls back to old scalar');
 near(model.account.turnExpense,0,'zero settled expense never falls back to previous flow');
 near(model.account.money,0,'zero stock is authoritative');
 ok(!model.forecast&&text(c,html,'上期收入')==='0','zero settlement stays actual in both displays');
 ok(!html.includes('stale')&&!html.includes('旧税'),'zero settlement does not revive old rows or custom tax amounts');
 ok(JSON.stringify(c.GM)===before,'zero-state render is read-only');
 c.TM.MinxinHardLinkConsumers.consume(c.GM,{turn:4});near(g.turnIncome,0,'consumer cannot resurrect a zero income from hard links');
}
{
 const c=fixture(),g=c.GM.guoku;c.GM._lastCascadeTurn=undefined;g.flowBasis='forecast';g.turnDays=10;delete g.turnIncome;delete g.turnExpense;g.monthlyIncome=900;g.monthlyExpense=600;g.annualIncome=10950;g.ledgers.money.thisTurnIn=0;g.ledgers.money.thisTurnOut=0;g.sources={tianfu:10950};
 const before=JSON.stringify(c.GM),view=c.FiscalStatement.read({game:c.GM,account:g}),html=c.renderFinanceRich();
 ok(view.forecast,'opening zero ledger is not a completed collection');near(view.account.turnIncome,300,'forecast monthly amount converts to ten days once');near(view.account.turnExpense,200,'forecast expense uses ten days');
 ok(text(c,html,'预计收入')==='300'&&text(c,html,'预计支出')==='200','rail distinguishes forecast from cash');
 ok(html.includes('预计 · 10日')&&!html.includes('1746.3万'),'forecast states its duration');
 ok(JSON.stringify(c.GM)===before,'forecast render cannot collect cash');
}
{
 const c=fixture(),g=c.GM.guoku;g.accounting={turn:2,days:10,daysPerYear:360};g.turnDays=30;
 const v=c.FiscalStatement.read({game:c.GM,account:g,turnDays:30});near(v.account.turnDays,10,'recorded settled period wins over next-turn length');near(v.account.annualIncome,10800,'recorded year length retained');
 g.accounting={turn:4,days:30,daysPerYear:365};const monthly=c.FiscalStatement.read({game:c.GM,account:g});near(monthly.account.monthlyIncome,300,'thirty-day period is not divided twice');ok(monthly.periodStatus==='current','current recorded period labeled current');
}
{
 const c=fixture();c.P.conf={gameMode:'strict_hist',reportedViewEnabled:true};
 c.TM.ReportedView.reveal('fiscal','guoku.money','test',6);
 const expected=c.TM.ReportedView.value('fiscal','fiscal.turnIncome',300,{direction:'good',dept:'fiscal'}),html=c.renderFinanceRich();
 ok(expected.distorted&&text(c,html,'上期收入')===c.rightFinanceMoney(expected.shown),'reported design still wraps canonical receipt');
 ok(html.includes('上期收支<span class="tm-reported-badge"'),'income distortion carries its own badge when stock is revealed');
 ok(html.includes('上期结余<span class="tm-reported-badge"'),'net based on distorted flows is marked');
 c.P.conf.reportedViewEnabled=false;const truth=c.renderFinanceRich();ok(text(c,truth,'上期收入')==='300'&&!truth.includes('tm-reported-badge'),'turning reported view off exposes actual ledger');
}
{
 const src=read('scripts/smoke-treasury-account-books.js').replace(/^#![^\n]*\n/,''),end=src.indexOf('let {c,scenario,elements}=fixture()');
 const create=new Function('require','__dirname',src.slice(0,end)+'\nreturn fixture;')(require,__dirname),{c}=create();installRail(c);
 let html=c.renderFinanceRich();ok(text(c,html,'预计收入')==='1000','unified opening rail uses budget forecast');
 c.CascadeTax.collect({turnDays:10});c.FixedExpense.collect({turnDays:10});const g=c.GM.guoku,l=g.ledgers.money;g.turnIncome=17463000;g.monthlyIncome=17463000;
 html=c.renderFinanceRich();near(Number(text(c,html,'本期收入')),l.thisTurnIn,'unified actual rail ignores corrupted display scalar');
 l.thisTurnIn=0;l.thisTurnOut=0;l.sources={stale:999};l.sinks={stale:999};html=c.renderFinanceRich();ok(text(c,html,'本期收入')==='0'&&!html.includes('stale'),'unified zero settlement uses same fixed path');
}
for(const partial of [{grain:{stock:10,thisTurnIn:2,thisTurnOut:0}},{money:{stock:10,thisTurnOut:5}}]){
 const c=fixture(),g=c.GM.guoku;g.ledgers=clone(partial);
 const before=JSON.stringify(g.ledgers),view=c.FiscalStatement.read({game:c.GM,account:g}),html=c.renderFinanceRich();
 ok(view.account.turnIncome===null&&view.account.monthlyIncome===null&&view.account.annualIncome===null,'absent money receipt remains unknown instead of polluted scalar');
 ok(view.account.lastDelta===null,'unknown receipt cannot produce a net amount');
 ok(text(c,html,'上期收入')==='待核'&&html.includes('<b>待核</b><span>上期结余'),'rail labels incomplete actual flow as pending verification');
 ok(html.includes('交割缺项'),'incomplete cash statement explains missing entries');
 if(partial.money)near(view.account.turnExpense,5,'known debit survives unknown receipt');else ok(view.account.turnExpense===null,'missing money ledger means unknown expense');
 ok(c._guokuReadDisplayModel(c.GM,g).account.turnIncome===null&&c._guokuFmt(null)==='待核','detail preserves unknown amount');
 c.TM.MinxinHardLinkConsumers.consume(c.GM,{turn:4});ok(g.turnIncome===null&&g.lastDelta===null,'consumer clears polluted unknown direction');
 ok(JSON.stringify(g.ledgers)===before,'unknown reconciliation does not manufacture missing receipts');
}
(async()=>{
 const file=path.join(__dirname,'smoke-native-fiscal-consumers.js'),src=fs.readFileSync(file,'utf8'),end=src.indexOf('(async () => {');
 const h=new Function('require','__dirname',src.slice(0,end)+'\nreturn {ctx,setup,load};')(require,__dirname);h.load('tm-fiscal-statements.js');
 const {g}=await h.setup(s=>{
  s.nativeStart.accounts.forEach(a=>{a.balance=0;a.flowModel={type:'fixed',periodDays:30,income:0,expense:10};});
  s.military.initialTroops.forEach(a=>Object.assign(a,{monthlyMoneyPayPerSoldier:0,monthlyGrainPayPerSoldier:0,monthlyClothPayPerSoldier:0}));
  s.officeTree.forEach(d=>(d.positions||[]).forEach(p=>p.salaryPayments=[]));
  Object.values(s.officeRegistryByFaction||{}).flat().forEach(d=>(d.positions||[]).forEach(p=>p.salaryPayments=[]));
 });
 let view=h.ctx.FiscalStatement.read({game:g,account:g.guoku,scope:'central'});ok(view.forecast&&view.account.turnExpense===10,'native opening still shows declared budget before settlement');
 h.ctx.TM.NativeFiscal.settle(g,'income',{turnDays:30});h.ctx.TM.NativeFiscal.settle(g,'expense',{turnDays:30});
 const before=JSON.stringify(g);view=h.ctx.FiscalStatement.read({game:g,account:g.guoku,scope:'central'});
 ok(!view.forecast&&view.account.turnIncome===0&&view.account.turnExpense===0,'native paid-zero receipt is actual, not budget');
 near(view.account.ledgers.money.deficit,10,'unpaid native expense stays a liability');
 ok(JSON.stringify(g)===before,'native actual-zero read does not post or settle again');
 console.log('[smoke-fiscal-actual-display] PASS '+checks+' assertions');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
