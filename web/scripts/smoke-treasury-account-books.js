#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');let count=0;
const clone=x=>JSON.parse(JSON.stringify(x));
function ok(v,name){assert(v,name);count++;}
function near(a,b,name){ok(Math.abs(a-b)<.03,name+': '+a+' / '+b);}
function fixture(){
 const cfg={accounting:{schema:'tm-fiscal-ledger/2',daysPerYear:360,daysPerMonth:30},daysPerTurn:10,unit:{money:'贯',grain:'石',cloth:'匹'},logisticsLoss:0,
  taxList:[{id:'cash',name:'户资产税',base:'taxableHouseholds',rate:36,annual:true,storeAs:'money'},{id:'rice',name:'田租',base:'taxableHouseholds',rate:3.6,annual:true,storeAs:'grain'},{id:'silk',name:'调绢',base:'taxableHouseholds',rate:.36,annual:true,storeAs:'cloth'}],
  centralLocalRules:{defaultPerTax:{qiyun:1,cunliu:0}},fixedExpense:{includeNamedOfficeSalaries:false,recurringExpenses:[
    {id:'work',name:'百司常用',funding:'central',monthly:{money:100,grain:10,cloth:1}},
    {id:'allotment',name:'岁给宫中',funding:'central',destination:'neitang',monthly:{money:300,grain:20,cloth:3}},
    {id:'palace',name:'宫中衣食',funding:'internal',monthly:{money:300,grain:20,cloth:3}}
  ]}};
 const scenario={id:'fixture-treasury',fiscalConfig:cfg,guoku:{initialMoney:10000,initialGrain:1000,initialCloth:1000,displayName:'国用府库',accountScope:'各库分别收支。'},
  neitang:{flowModel:'explicit-ledger-v1',initialMoney:1000,initialGrain:100,initialCloth:100,displayName:'宫中内库',accountScope:'宫中供用有常额。',custodyNote:'宫中钱物与个人家资分册。',monthlyIncomeEstimate:{money:990000},monthlyExpenseEstimate:{money:880000},ceremonies:[{id:'minor',name:'奉先荐献',cost:{money:50,grain:2,cloth:1}}]}};
 const G={sid:scenario.id,turn:1,scenario:clone(scenario),playerInfo:{factionId:'唐',factionName:'唐'},fiscalConfig:clone(cfg),facs:[{id:'唐',name:'唐',fiscalConfig:clone(cfg)}],chars:[{id:'emperor',name:'李瀍',isPlayer:true,resources:{privateWealth:{money:1034,grain:42,cloth:12}}}],armies:[],officeTree:[],
  adminHierarchy:{player:{factionId:'唐',divisions:[{id:'A',name:'甲州',populationDetail:{mouths:6000,households:1100,taxableHouseholds:1000},economyBase:{farmland:1000},corruption:0,prosperity:50,minxin:60,fiscalDetail:{compliance:1,skimmingRate:0,autonomyLevel:0}}]}},
  guoku:{money:10000,balance:10000,grain:1000,cloth:1000},neitang:{money:1000,balance:1000,grain:100,cloth:100}};
 const elements={};for(const id of ['guoku-body','guoku-subtitle','neitang-body','neitang-subtitle'])elements[id]={innerHTML:'',textContent:''};
 const c={GM:G,P:{playerInfo:clone(G.playerInfo),time:{daysPerTurn:10},fiscalConfig:clone(cfg)},Date,Math,JSON,console:{log(){},warn(){},error(){}},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},fetch(){throw Error('Network forbidden in treasury fixture');},_getDaysPerTurn:()=>10,
  document:{getElementById:id=>elements[id]||null,querySelector:()=>null,addEventListener(){}},_escHtml:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),findScenarioById:()=>scenario};
 c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-field-pipelines.js','tm-public-treasury.js','tm-fiscal-statements.js','tm-fiscal-engine.js','tm-guoku-engine.js','tm-neitang-engine.js','tm-guoku-panel.js','tm-neitang-panel.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});
 c.GuokuEngine.initFromDynasty('唐','late',scenario);c.NeitangEngine.initFromDynasty('唐','late',scenario);
 return {c,scenario,elements};
}
let {c,scenario,elements}=fixture(),start=JSON.stringify(c.GM),personal=JSON.stringify(c.GM.chars[0].resources.privateWealth);
ok(c.NeitangEngine.isExplicit(),'new fiscal scheme uses actual inner treasury');
near(c.GM.neitang.money,1000,'opening stock is declaration, not monthly allowance');
near(c.GM.neitang.monthlyIncome,300,'opening monthly field is the same-source planned allowance');
near(c.GM.neitang.ledgers.money.thisTurnIn,0,'opening estimated income does not become receipt');
near(c.GM.neitang.ledgers.money.thisTurnOut,0,'opening estimated spending does not spend cash');
ok(!c.GM.neitang._royalClan&&!c.GM.neitang._presetName,'no invented dynastic households or random tribute preset');
c.renderGuokuPanel();c.renderNeitangPanel();
ok(JSON.stringify(c.GM)===start,'both renders are read-only');
ok(['回合速察','三账库存','岁入分项','岁出分项'].every(x=>elements['guoku-body'].innerHTML.includes(x))&&elements['guoku-subtitle'].textContent.startsWith('预计'),'common fields retain a clearly marked opening forecast');
ok(!/民心顺从|endTurn|级联|皇家私库|矿监税监|明末|群臣感泣/.test(elements['guoku-body'].innerHTML+elements['neitang-body'].innerHTML),'no false probability or anachronistic defaults in v2 panels');
ok(['税制','钱法','核库','赈济','两库支拨'].every(x=>elements['guoku-body'].innerHTML.includes(x)),'treasury actions remain accessible');
c.GM.neitang.balance=999;c.GM.neitang.money=999;c.GM.neitang.ledgers.money.stock=0;c.NeitangEngine.ensureModel();
near(c.GM.neitang.money,0,'zero inner ledger is not filled from stale scalar');
c.GM.guoku.balance=999;c.GM.guoku.money=999;c.GM.guoku.ledgers.money.stock=0;c.GuokuEngine.ensureModel();near(c.GM.guoku.money,0,'zero state ledger is not filled from stale scalar');
({c,scenario,elements}=fixture());
for(const x of [0,-100,NaN,Infinity]){start=JSON.stringify(c.GM);ok(!c.NeitangEngine.Actions.transferFromGuoku(x).success,'invalid transfer rejected '+x);ok(JSON.stringify(c.GM)===start,'invalid transfer did not mutate '+x);}
start=JSON.stringify(c.GM);c.NeitangEngine.processIncidentalSources(1);c.NeitangEngine.applyRoyalClanPressure(1);ok(JSON.stringify(c.GM)===start,'direct legacy incidental hooks do not invent v2 flows');
ok(!c.NeitangEngine.Actions.recordConfiscation(100).success&&JSON.stringify(c.GM)===start,'unidentified confiscation cannot create money');
ok(!c.NeitangEngine.Actions.enableSpecialTax('矿税',5000).success&&JSON.stringify(c.GM)===start,'unbacked mining levy cannot collect or change approval');
ok(typeof c.FiscalEngine.transferAccountResources==='function'&&typeof c.FiscalEngine.trySpendFromAccount==='function','shared transfer and spending interfaces installed');
const beforeGuoku=c.GM.guoku.money,beforeInner=c.GM.neitang.money;
let transfer=c.NeitangEngine.Actions.transferResources({from:'guoku',to:'neitang',amounts:{money:250,grain:20,cloth:3},transactionId:'manual-1',reason:'拨给宫中'});
ok(transfer.success,'three-resource transfer succeeds');near(c.GM.guoku.money,beforeGuoku-250,'source money deducted');near(c.GM.neitang.money,beforeInner+250,'destination money credited');
near(c.GM.guoku.grain,980,'source grain deducted');near(c.GM.neitang.grain,120,'destination grain credited');
near(c.GM.guoku.cloth,997,'source cloth deducted');near(c.GM.neitang.cloth,103,'destination cloth credited');
start=JSON.stringify(c.GM);transfer=c.NeitangEngine.Actions.transferResources({from:'guoku',to:'neitang',amounts:{money:250,grain:20,cloth:3},transactionId:'manual-1',reason:'拨给宫中'});ok(transfer.success&&JSON.stringify(c.GM)===start,'duplicate receipt does not pay twice');
const bad=c.NeitangEngine.Actions.transferResources({from:'guoku',to:'neitang',amounts:{money:1,grain:100000},transactionId:'manual-2'});ok(!bad.success&&JSON.stringify(c.GM)===start,'short grain fails all resources atomically');
const innerBefore=c.GM.neitang.money;ok(c.NeitangEngine.Actions.holdCeremony('minor',{transactionId:'ceremony-1'}).success,'authored ceremony spends through real ledger');near(c.GM.neitang.money,innerBefore-50,'ceremony debit real');
start=JSON.stringify(c.GM);ok(c.NeitangEngine.Actions.holdCeremony('minor',{transactionId:'ceremony-1'}).success&&JSON.stringify(c.GM)===start,'ceremony receipt prevents duplicate spend');
c.NeitangEngine.monthlySettle(1/3);near(c.GM.neitang.money,innerBefore-50,'summary cannot restore spent ceremony money');near(c.GM.neitang.turnIncome,250,'summary includes actual transfer');near(c.GM.neitang.turnExpense,50,'summary includes actual external expense');
const histLength=c.GM.neitang.history.monthly.length;c.NeitangEngine.monthlySettle(1/3);ok(c.GM.neitang.history.monthly.length===histLength,'repeat summary does not append duplicate period');
ok(JSON.stringify(c.GM.chars[0].resources.privateWealth)===personal,'imperial institutional transactions never enter private wealth');
({c,scenario,elements}=fixture());const monthly=c.CascadeTax.previewBudget({turnDays:30});
near(monthly.expenses.central.money,400,'central budget contains allotment');near(monthly.expenses.internal.money,300,'palace expense uses inner account');near(monthly.expenses.total.money,400,'national final expense excludes internal transfer');
near(c.NeitangEngine.getBudgetView().income.money,300,'inner allowance forecast consumes same live budget');
const fullBefore={money:c.GM.guoku.money+c.GM.neitang.money,grain:c.GM.guoku.grain+c.GM.neitang.grain,cloth:c.GM.guoku.cloth+c.GM.neitang.cloth};
c.CascadeTax.collect({turnDays:10});c.FixedExpense.collect({turnDays:10});c.NeitangEngine.monthlySettle(1/3);
for(const k of ['money','grain','cloth'])near(c.GM.guoku[k]+c.GM.neitang[k],fullBefore[k]+monthly.totals.central[k]/3-monthly.expenses.total[k]/3,'public plus inner conservation '+k);
near(c.GM.neitang.turnIncome,100,'ten-day allowance is one third of month');near(c.GM.neitang.turnExpense,100,'ten-day palace use is one third of month');
start=JSON.stringify(c.GM);c.FixedExpense.collect({turnDays:10});ok(JSON.stringify(c.GM)===start,'fixed expense does not repeat transfer');
c.GM.turn=2;c.GM.facs[0].fiscalConfig.fixedExpense.recurringExpenses=[];c.GM.fiscalConfig.fixedExpense.recurringExpenses=[];
c.CascadeTax.collect({turnDays:10});c.FixedExpense.collect({turnDays:10});c.NeitangEngine.monthlySettle(1/3);near(c.GM.neitang.turnIncome,0,'zero next-period inner receipt is not previous receipt');near(c.GM.neitang.turnExpense,0,'zero next-period inner expense is not previous expense');
c.GM.neitang.history.monthly=Array.from({length:36},(_,i)=>({turn:i+1,fiscalTurn:i+1,periodDays:10,periodIncome:100,periodExpense:80,resources:{money:{income:100,expense:80},grain:{income:10,expense:8},cloth:{income:1,expense:.8}}}));
const year=c.NeitangEngine.yearlySettle();near(year.totalIncome,3600,'annual archive uses 36 ten-day periods');near(year.totalExpense,2880,'annual spending uses actual periods');near(year.resources.grain.income,360,'annual grain remains separate');near(year.periodDays,360,'annual period explicit');
({c,scenario,elements}=fixture());
c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:[
 {id:'guoku',name:'唐国用库',kind:'physical',scope:'central',factionId:'唐',source:{kind:'guoku'}},
 {id:'neitang',name:'唐内库',kind:'physical',scope:'palace',factionId:'唐',source:{kind:'neitang'}},
 {id:'japan-central',name:'日本公用库',kind:'physical',scope:'central',factionId:'日本',source:{kind:'faction',id:'日本'}}
]};
c.GM.facs[0].treasury=clone(c.GM.guoku);c.GM.facs[0].innerTreasury=clone(c.GM.neitang);
c.GM.facs.push({id:'日本',name:'日本',fiscalConfig:clone(c.GM.fiscalConfig),treasury:{money:555,grain:55,cloth:5}});
c.GM.playerInfo={factionId:'日本',factionName:'日本'};c.GM.guoku={money:555,balance:555,grain:55,cloth:5};c.GuokuEngine.ensureModel();
ok(c.NeitangEngine.getAccountContext().internalRef===null,'foreign realm without declared inner funds does not inherit Tang treasury');
start=JSON.stringify(c.GM);c.renderNeitangPanel();ok(elements['neitang-body'].innerHTML.includes('内库簿籍未具'),'missing foreign inner treasury says no account, not zero');
ok(!c.NeitangEngine.Actions.rescueGuoku(50).success&&JSON.stringify(c.GM)===start,'foreign player cannot spend Tang inner treasury');
c.renderGuokuPanel();ok(elements['guoku-body'].innerHTML.includes('日本公用库')&&!elements['guoku-body'].innerHTML.includes('唐国用库'),'central consolidation scoped to current faction');
near(c.FiscalEngine.getAccountView({game:c.GM,ref:'guoku'}).resources.money.stock,10000,'explicit Tang account stays Tang under foreign control');
({c,scenario,elements}=fixture());
c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:[{id:'guoku',name:'国用总库',kind:'physical',scope:'central',factionId:'唐',source:{kind:'guoku'}},{id:'neitang',name:'宫中库',kind:'physical',scope:'palace',factionId:'唐',source:{kind:'neitang'}}]};
c.NeitangEngine.Actions.transferFromGuoku(250,{transactionId:'before-tax'});
c.CascadeTax.collect({turnDays:10});
near(c.GM.guoku.ledgers.money.thisTurnOut,250,'manual payment before same-period tax collection remains in ledger');
near(c.GM.neitang.ledgers.money.thisTurnIn,250,'manual receipt before same-period collection remains in ledger');
c.FixedExpense.collect({turnDays:10});c.NeitangEngine.monthlySettle(1/3);
near(c.GM.neitang.turnIncome,350,'same-period manual and regular allocation both counted once');
c.GuokuEngine.monthlySettle(1/3);const innerHistory=c.GM.neitang.history.monthly.length,publicHistory=c.GM.guoku.history.monthly.length;
c.GM.turn++;c.NeitangEngine.monthlySettle(1/3);c.GuokuEngine.monthlySettle(1/3);
ok(c.GM.neitang.history.monthly.length===innerHistory&&c.GM.guoku.history.monthly.length===publicHistory,'turn counter increment does not duplicate the same fiscal period archive');
({c,scenario,elements}=fixture());c.CascadeTax.collect({turnDays:10});c.FixedExpense.collect({turnDays:10});
c.GM.neitang.extraIncome=[{name:'已交常供',amount:360,resource:'money',recurring:true}];c.GM.guoku.extraExpense=[{name:'临定岁例',amount:360,resource:'money',recurring:true}];
c.NeitangEngine.monthlySettle(1/3);c.GuokuEngine.monthlySettle(1/3);const afterRecurring={inner:c.GM.neitang.money,public:c.GM.guoku.money};
c.GM.turn++;c.NeitangEngine.monthlySettle(1/3);c.GuokuEngine.monthlySettle(1/3);
near(c.GM.neitang.money,afterRecurring.inner,'same fiscal period extra receipt not repeated after turn increment');near(c.GM.guoku.money,afterRecurring.public,'same fiscal period extra expense not repeated after turn increment');
({c,scenario,elements}=fixture());
for(const name of ['guoku','neitang'])for(const k of ['money','grain','cloth']){c.GM[name].ledgers[k].stock=0;c.GM[name][k]=0;if(k==='money')c.GM[name].balance=0;}
c.GM.neitang.ledgers.money.stock=10;c.GM.neitang.balance=10;c.GM.neitang.money=10;
const underfunded=c.FixedExpense.collect({turnDays:30});
near(c.GM.neitang.money,0,'underfunded palace spends real stock only');near(c.GM.guoku.money,0,'underfunded allotment cannot create central money');
near(c.GM.neitang.ledgers.money.deficit,290,'palace actual unpaid obligation recorded');near(c.GM.guoku.ledgers.money.deficit,100,'central actual unpaid obligation recorded');
near(underfunded.deficit.money,390,'internal allocation shortage does not double count external unpaid obligations');
({c,scenario,elements}=fixture());
c.GM.officeTree=[{id:'finance-office',name:'计司',positions:[]}];
c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:[
 {id:'guoku',name:'国用总库',kind:'physical',scope:'central',factionId:'唐',source:{kind:'guoku'}},
 {id:'neitang',name:'宫中库',kind:'physical',scope:'palace',factionId:'唐',source:{kind:'neitang'}},
 {id:'office-cash',name:'计司周转库',kind:'physical',scope:'central',factionId:'唐',source:{kind:'department',id:'finance-office'},openingTransfer:{from:'guoku',amounts:{money:200,grain:10,cloth:4}}}
]};
ok(c.FiscalEngine.initializePublicTreasuries({game:c.GM,scenario}).ok,'department allocation initialized from existing central funds');
near(c.GM.guoku.money,9800,'department allocation decreases parent stock');near(c.FiscalEngine.getConsolidatedView({game:c.GM,scope:'central',factionId:'唐'}).resources.money.stock,10000,'department allocation does not change whole central inventory');
near(c.GM.guoku.ledgers.money.thisTurnOut,0,'opening stock allocation is not a paid expense');
c.CascadeTax.collect({turnDays:10});const expectedIn=c.GM.guoku.ledgers.money.thisTurnIn,whole=c.FiscalEngine.getConsolidatedView({game:c.GM,scope:'central',factionId:'唐'});
near(whole.resources.money.thisTurnIn,expectedIn,'empty new department flows do not erase total actual receipts');
c.renderGuokuPanel();ok(elements['guoku-body'].innerHTML.includes('计司周转库'),'department appears in central books');
({c,scenario,elements}=fixture());
c.GM.currency={accounting:{schema:'tm-market-ledger/2',coinPerMoney:1000},mintAgencies:[{id:'mint-a',name:'钱监甲',capacity:3600000}]};
start=JSON.stringify(c.GM);c.renderGuokuPanel();
ok(elements['guoku-body'].innerHTML.includes('月铸额</span><span>3,600 贯'),'monthly coin capacity is converted to monthly fiscal money');
ok(!elements['guoku-body'].innerHTML.includes('岁能')&&elements['guoku-body'].innerHTML.includes('入库净息以交割簿为准'),'mint capacity is not annual output or treasury profit');
ok(JSON.stringify(c.GM)===start,'mint display neither mints coins nor credits revenue');
c.GM.currency.accounting.coinPerMoney=2000;c.renderGuokuPanel();ok(elements['guoku-body'].innerHTML.includes('月铸额</span><span>1,800 贯'),'mint display follows declared conversion rather than a fixed factor');
({c,scenario,elements}=fixture());
Object.assign(scenario.neitang,{initialMoney:650000,initialGrain:90000,initialCloth:85000});c.NeitangEngine.initFromDynasty('唐','late',scenario);
c.GM.officeTree=[{id:'palace-office',name:'殿中省',positions:[]}];
c.GM.facs.push({id:'外国',name:'外国',innerTreasury:{money:999999,grain:99999,cloth:99999}});
c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:[
 {id:'guoku',name:'国用总库',kind:'physical',scope:'central',factionId:'唐',source:{kind:'guoku'}},
 {id:'neitang',name:'内库总库',kind:'physical',scope:'palace',factionId:'唐',source:{kind:'neitang'}},
 {id:'palace-supply',name:'殿中供用库',kind:'physical',scope:'palace',factionId:'唐',source:{kind:'department',id:'palace-office'},openingTransfer:{from:'neitang',amounts:{money:12000,grain:1800,cloth:3600}}},
 {id:'palace-alias',name:'别名重复库',kind:'physical',scope:'palace',factionId:'唐',source:{kind:'neitang'}},
 {id:'palace-pool',name:'宫中汇总',kind:'pool',scope:'palace',factionId:'唐',members:['neitang','palace-supply']},
 {id:'foreign-palace',name:'外国宫中库',kind:'physical',scope:'palace',factionId:'外国',source:{kind:'innerTreasury',id:'外国'}}
]};
ok(c.FiscalEngine.initializePublicTreasuries({game:c.GM,scenario}).ok,'palace department allocated from actual existing inner treasury');
const palace=c.FiscalEngine.getConsolidatedView({game:c.GM,scope:'palace',factionId:'唐'});
near(palace.resources.money.stock,650000,'palace consolidated money includes main and department exactly once');
near(palace.resources.grain.stock,90000,'palace consolidated grain conserved');near(palace.resources.cloth.stock,85000,'palace consolidated cloth conserved');
near(c.FiscalEngine.getAccountView({game:c.GM,ref:'neitang'}).resources.money.available,638000,'main inner account retains actual available balance');
start=JSON.stringify(c.GM);c.renderNeitangPanel();const palaceHtml=elements['neitang-body'].innerHTML;
ok(['宫中诸库合计','宫中分库簿','殿中供用库','内库总库可支','650,000','90,000','85,000','638,000'].every(x=>palaceHtml.includes(x)),'palace renderer exposes consolidated resources, subaccounts, and main availability');
ok(!palaceHtml.includes('别名重复库')&&!palaceHtml.includes('外国宫中库'),'palace display omits duplicate aliases and foreign funds');
ok(JSON.stringify(c.GM)===start,'palace consolidated rendering remains pure');
console.log('[smoke-treasury-account-books] PASS '+count+' assertions');
