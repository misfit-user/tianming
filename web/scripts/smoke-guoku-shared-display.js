'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');const ROOT=path.resolve(__dirname,'..');let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const old=fs.readFileSync(path.join(__dirname,'smoke-treasury-account-books.js'),'utf8').replace(/^#![^\n]*\n/,''),end=old.indexOf('let {c,scenario,elements}=fixture()');assert(end>0);const getFixture=new Function('require','__dirname',old.slice(0,end)+'\nreturn fixture;')(require,__dirname);
const fixture=()=>{const x=getFixture();vm.runInContext(fs.readFileSync(path.join(ROOT,'tm-lizhi-panel.js'),'utf8'),x.c);return x;};
const required=['回合速察','三账库存','税赋三数','岁入分项','岁出分项','帑廪趋势','财政改革','如何措置'];
const core=html=>required.filter(x=>html.includes('tr-section-name">'+x));
const slots=html=>[...html.matchAll(/tr-qs-label">([^<]+)/g)].map(x=>x[1].replace(/月|回合/g,'期间'));
const captions=[];
for(const type of ['legacy-tianqi','legacy-shaosong','declared']){
 const {c,elements}=fixture();if(type!=='declared'){c.CascadeTax.isUnified=()=>false;c.GM.guoku.monthlyIncome=300;c.GM.guoku.turnIncome=100;c.GM.guoku.monthlyExpense=150;c.GM.guoku.turnExpense=50;c.GM.guoku.annualIncome=3600;c.GM.guoku.sources={tianfu:2500,yanlizhuan:1100};c.GM.guoku.expenses={fenglu:1000,junxiang:800};}
 c.GM.minxin={trueIndex:0};c.GM.huangquan={index:0};const before=JSON.stringify(c.GM);c.renderGuokuPanel();const html=elements['guoku-body'].innerHTML;
 ok(JSON.stringify(c.GM)===before,'render does not write '+type);ok(JSON.stringify(core(html))===JSON.stringify(required),'shared core sections '+type);
 ok(slots(html).length===6,'same six overview fields '+type);captions.push(slots(html));ok(html.includes('tr-flow-group income')&&html.includes('tr-flow-group expense'),'same resource flow groups '+type);
 ok(['应征（名义）','官府实收','民间实缴'].every(x=>html.includes(x)),'three-number tax fields '+type);
 if(type==='declared'){const model=c._guokuReadDisplayModel(c.GM,c.GM.guoku);ok(model.forecast&&elements['guoku-subtitle'].textContent.startsWith('预计'),'forecast explicitly labeled');ok(model.account.ledgers.money.stock===10000,'preview does not enter stock');ok(Math.abs(model.taxThree.actualReceived-(model.summary.central.money+model.summary.localRetain.money))<.0001,'same-source national tax receipt');ok(model.taxThree.peasantPaid===model.summary.grossCollected.money,'no invented overcollection');ok(!html.includes('可支配 85%'),'declared authority does not use legacy multiplier');}
}
ok(JSON.stringify(captions[0])===JSON.stringify(captions[1])&&JSON.stringify(captions[1])===JSON.stringify(captions[2]),'all models share exactly the same overview fields');
{
 const {c,elements}=fixture();c.CascadeTax.collect({turnDays:10});c.FixedExpense.collect({turnDays:10});const model=c._guokuReadDisplayModel(c.GM,c.GM.guoku);ok(!model.forecast,'posted cash does not become a forecast');
 for(const k of ['money','grain','cloth']){const l=c.GM.guoku.ledgers[k];l.stock=0;l.thisTurnIn=0;l.thisTurnOut=0;l.lastTurnIn=987654;l.lastTurnOut=876543;l.sources={stale:987654};l.sinks={stale:876543};}
 c.GM.guoku.balance=999999;c.GM.guoku.monthlyIncome=888888;c.GM.guoku.monthlyExpense=777777;const before=JSON.stringify(c.GM);c.renderGuokuPanel();const html=elements['guoku-body'].innerHTML,zero=c._guokuReadDisplayModel(c.GM,c.GM.guoku);
 ok(JSON.stringify(c.GM)===before,'zero balance rendering remains read-only');ok(!zero.forecast&&zero.account.turnIncome===0&&zero.account.turnExpense===0,'settled zero is real zero');ok(['money','grain','cloth'].every(k=>zero.account.ledgers[k].stock===0),'live zero never falls back to scalar inventory');ok(!html.includes('stale')&&html.includes('本期尚无钱粮入库'),'old period entries never return after a zero settlement');ok(!elements['guoku-subtitle'].textContent.startsWith('预计'),'zero settled period not disguised as forecast');
}
{
 const {c,elements}=fixture();c.GM.guoku.ledgers.money.thisTurnOut=7;c.GM.guoku.ledgers.money.sinks={'临时拨付':7};c.renderGuokuPanel();const view=c._guokuReadDisplayModel(c.GM,c.GM.guoku);ok(!view.forecast&&view.account.turnExpense===7,'manual payment before tax collection remains actual');ok(elements['guoku-body'].innerHTML.includes('临时拨付'),'unclassified real payment stays visible');
}
{
 const {c,elements,scenario}=fixture();c.CascadeTax.isUnified=()=>false;scenario.fiscalConfig.taxList.push({id:'dingshen',sourceTag:'ding',name:'丁税·身丁钱',storeAs:'money'});c.GM.guoku.ledgers.money.sources={ding:12};c.GM.guoku.ledgers.money.thisTurnIn=12;c.renderGuokuPanel();ok(elements['guoku-body'].innerHTML.includes('丁税·身丁钱'),'legacy tax IDs resolve to authored Chinese names');ok(!elements['guoku-body'].innerHTML.includes('>ding<'),'internal tax key is not player-facing');
}
{
 const {c,elements}=fixture(),cfg=c.GM.facs[0].fiscalConfig;
 cfg.fixedExpense.recurringExpenses[0].sourceTag='waterway';cfg.fixedExpense.recurringExpenses[0].sourceName='河渠舟运';
 cfg.fixedExpense.administrativeStaff=[{name:'簿书吏食',funding:'central',count:2,monthlyPay:{money:15},sourceTag:'clerks',sourceName:'官署胥吏'}];
 c.GM.armies=[{id:'army-fixture',name:'渡口守兵',faction:'唐',soldiers:10,monthlyMoneyPayPerSoldier:2,monthlyGrainPayPerSoldier:0,monthlyClothPayPerSoldier:0,sourceTag:'garrison',sourceName:'州镇军粮'}];
 const preview=c.CascadeTax.previewBudget({game:c.GM,turnDays:10}),snapshot=JSON.stringify(c.GM);
 ok(preview.expenses.items.some(r=>r.sourceTag==='waterway'&&r.sourceName==='河渠舟运'),'recurring expense category reaches production budget');
 ok(preview.expenses.items.some(r=>r.sourceTag==='clerks'),'staff category reaches production budget');
 ok(preview.expenses.items.some(r=>r.sourceTag==='garrison'),'army category reaches production budget');
 c.renderGuokuPanel();const turnHtml=elements['guoku-body'].innerHTML;
 ok(['河渠舟运','官署胥吏','州镇军粮'].every(n=>turnHtml.includes(n)),'declared expense names visible as separate rows');
 ok(!turnHtml.includes('>waterway<')&&!turnHtml.includes('>garrison<'),'authored categories never leak identifiers');
 c._guokuSetFlowPeriod('month');const monthHtml=elements['guoku-body'].innerHTML;
 ok(monthHtml.includes('三账 · 月均')&&monthHtml.includes('月均 3000'),'monthly comparison multiplies ten-day receipts by three');
 c._guokuSetFlowPeriod('year');const yearHtml=elements['guoku-body'].innerHTML;
 ok(yearHtml.includes('三账 · 岁计')&&yearHtml.includes('岁计 3.6万'),'annual comparison uses declared 360-day year');
 ok(snapshot===JSON.stringify(c.GM),'period switch never changes any world state or inventories');
 c._guokuSetFlowPeriod('turn');ok(elements['guoku-body'].innerHTML===turnHtml,'return to current period restores exact rows');
 c._guokuSetFlowPeriod('invalid');ok(c._guokuFlowPeriod==='turn','invalid period ignored');
 c.CascadeTax.collect({turnDays:10});const paid=c.FixedExpense.collect({turnDays:10});ok(paid.ok,'granular budget actually pays');
 const posted=c._guokuReadDisplayModel(c.GM,c.GM.guoku);
 ok(!posted.forecast&&posted.account.ledgers.money.sinks['其他']>0&&posted.account.ledgers.money.sinks['军饷']>0&&posted.account.ledgers.money.sinks['俸禄']>0,'actual payment uses common fiscal categories');
 ok(posted.expenseDetailsByResource.money.junxiang.some(r=>r.name.includes('渡口守兵'))&&posted.expenseDetailsByResource.money.fenglu.some(r=>r.name.includes('簿书吏食')),'common categories retain funded item details');
 ok(Math.abs(Object.values(posted.account.ledgers.money.sinks).reduce((a,v)=>a+v,0)-posted.account.turnExpense)<.001,'actual displayed expense rows reconcile to debit');
 c._guokuSetFlowPeriod('year');ok(elements['guoku-body'].innerHTML.includes('三账 · 折年'),'annualized posted values clearly distinguished from realized annual totals');
 ok(c._guokuFmt(12345)==='1.23万'&&c._guokuFmt(100000)==='10万','ten-thousand formatting retains meaningful precision');
}
{
 const {c,elements}=fixture();c.CascadeTax.collect({turnDays:10});c.FixedExpense.collect({turnDays:10});
 const actual=c._guokuReadDisplayModel(c.GM,c.GM.guoku).account.turnIncome;
 c._getDaysPerTurn=()=>30;const before=JSON.stringify(c.GM),recorded=c._guokuReadDisplayModel(c.GM,c.GM.guoku);
 ok(recorded.account.turnDays===10&&recorded.budget.period.days===10,'settled ten-day ledger keeps its own period when next turn length changes');
 c._guokuSetFlowPeriod('year');ok(elements['guoku-body'].innerHTML.includes('折年 '+c._guokuFmt(actual*36)),'annualized posted income uses recorded ten-day period');
 ok(JSON.stringify(c.GM)===before,'reading a historical period does not rewrite accounting stamps');
}
{
 const {c,elements}=fixture();c.CascadeTax.isUnified=()=>false;c.GM.guoku.turnDays=10;
 c.GM.guoku._customTaxStats={unique:{name:'独立旧税细目',amount:3650,turnAmount:100}};
 c._guokuSetFlowPeriod('year');let html=elements['guoku-body'].innerHTML;
 ok(html.includes('>独立旧税细目</span>')&&html.includes('>3650</span>'),'legacy custom tax uses real turn amount, not annual amount multiplied again');
 delete c.GM.guoku._customTaxStats.unique.turnAmount;c._guokuSetFlowPeriod('month');html=elements['guoku-body'].innerHTML;
 ok(html.includes('折月 300'),'legacy custom tax with only annual data is prorated once');
 c.GM.guoku.ledgers.money.sources={unique:100};c.GM.guoku.ledgers.money.thisTurnIn=100;c.renderGuokuPanel();
 ok(!elements['guoku-body'].innerHTML.includes('其他税入细目'),'same custom tax is not repeated below the primary source list');
}
console.log('[smoke-guoku-shared-display] PASS '+checks+' assertions');
