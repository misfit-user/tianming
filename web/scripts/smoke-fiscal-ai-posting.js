#!/usr/bin/env node
'use strict';
// Production AI bundle + fiscal owners, detached state only. No AI call or campaign tick.
const fs=require('fs'),path=require('path'),vm=require('vm');
const web=path.resolve(__dirname,'..'),R=['money','grain','cloth'],copy=x=>JSON.parse(JSON.stringify(x));
const h=fs.readFileSync(path.join(__dirname,'smoke-ai-writeback-integrity.js'),'utf8').replace(/^#![^\n]*\n/,'').split('async function main()')[0];
const helpers=new Function('require','__dirname',h+';return {makeContext,baseGM};')(require,__dirname);
let checks=0,cases=0;
function ok(v,m){if(!v)throw Error(m);checks++;}
function eq(a,b,m){ok(JSON.stringify(a)===JSON.stringify(b),m+' got '+JSON.stringify(a)+' expected '+JSON.stringify(b));}
function sum(rows){return Object.values(rows||{}).flat().reduce((n,r)=>n+r.amount,0);}
function fixture(legacy=false){
 const c=helpers.makeContext(),cfg={accounting:{schema:'tm-fiscal-ledger/2'},daysPerTurn:10,unit:{money:'贯',grain:'石',cloth:'匹'},logisticsLoss:0,taxList:[],centralLocalRules:{defaultPerTax:{qiyun:1,cunliu:0}},fixedExpense:{includeNamedOfficeSalaries:false,administrativeStaff:[],recurringExpenses:[]}};
 const publicCfg={schema:'tm-public-treasury/2',accounts:[{id:'guoku',name:'公库',kind:'physical',scope:'central',factionId:'A',source:{kind:'guoku'}},{id:'neitang',name:'内府',kind:'physical',scope:'palace',factionId:'A',source:{kind:'neitang'}},{id:'region:r',name:'州库',kind:'physical',scope:'regional',factionId:'A',source:{kind:'region',id:'r'}}]};
 c.GM=helpers.baseGM({sid:'posting',turn:2,turnDays:10,playerInfo:{factionId:'A'},facs:[{id:'A',name:'甲',officeTree:[],...(legacy?{}:{fiscalConfig:copy(cfg)})}],guoku:{money:1000,grain:500,cloth:200},neitang:{money:100,grain:50,cloth:20},adminHierarchy:{player:{factionId:'A',divisions:[{id:'r',name:'本州',publicTreasuryInit:{money:100,grain:50,cloth:20},populationDetail:{mouths:500,taxableHouseholds:100},fiscalDetail:{compliance:1},economyBase:{farmland:1000}}]}},...(legacy?{}:{fiscalConfig:copy(cfg),publicTreasuryConfig:publicCfg})});
 c.P={playerInfo:c.GM.playerInfo,time:{daysPerTurn:10},...(legacy?{}:{fiscalConfig:cfg})};
 c._getDaysPerTurn=()=>c.GM.turnDays;c._dbg=()=>{};c.fetch=()=>{throw Error('network forbidden');};
 for(const file of ['tm-field-pipelines.js','tm-public-treasury.js','tm-fiscal-statements.js','tm-fiscal-engine.js'])vm.runInContext(fs.readFileSync(path.join(web,file),'utf8'),c,{filename:file});
 if(!legacy){c.FiscalEngine.initializePublicTreasuries({game:c.GM,scenario:{publicTreasuryConfig:publicCfg}});c.CascadeTax.applyBudgetSnapshot({game:c.GM});}
 c.FiscalEngine.addToGuoku({},'fixture',c.GM);c.FiscalEngine.addToNeitang({},'fixture');
 return c;
}
function fa(id,kind,resource,amount,target='guoku',extra={}){return {id,target,kind,resource,amount,name:'同名交割',recurring:false,sourceTag:kind==='income'?'qita':'junxiang',...extra};}
function apply(c,rows,extra={}){return c.applyAITurnChanges({fiscal_adjustments:rows,...extra});}
function leaf(c){return c.GM.adminHierarchy.player.divisions[0];}
function run(name,fn){fn();cases++;console.log('  PASS '+name);}

run('v2 actual three resources and raw period/annual category fields',()=>{
 const c=fixture(),out=[10.25,2,.125],inc=[4,3,.25],body=R.flatMap((k,i)=>[fa('out-'+k,'expense',k,out[i]),fa('in-'+k,'income',k,inc[i])]);
 ok(apply(c,body).ok,'three-resource batch commits');
 R.forEach((k,i)=>{const a=c.GM.guoku,b=a.ledgers[k],suffix=k==='money'?'':k[0].toUpperCase()+k.slice(1);eq(b.stock,[1000,500,200][i]-out[i]+inc[i],k+' stock');eq(b.thisTurnOut,out[i],k+' expense');eq(b.thisTurnIn,inc[i],k+' income');eq(sum(b.sinkDetails),out[i],k+' paid detail sum');eq(sum(b.sourceDetails),inc[i],k+' income detail sum');eq(a['turn'+suffix+'Expense'],out[i],k+' raw turn');eq(a['monthly'+suffix+'Expense'],out[i]*3,k+' raw month');eq(a['annual'+suffix+'Expense'],out[i]*36,k+' raw year');});
 eq(c.GM.guoku.expenses.junxiang,369,'annual standard expense key');eq(c.GM.guoku.sources.qita,144,'annual standard income key');
 const saved=JSON.stringify(c.GM.guoku);ok(apply(c,copy(body)).ok,'retry succeeds');eq(JSON.stringify(c.GM.guoku),saved,'successful retry does not duplicate stock, flows, entries or shortage');
});
run('same names retain distinct IDs; anonymous identical retry; conflicting ID rollback',()=>{
 const c=fixture();ok(apply(c,[fa('first','expense','money',10),fa('second','expense','money',20)]).ok,'distinct postings');
 eq(c.GM.guoku.ledgers.money.sinkDetails.junxiang.map(r=>[r.id,r.amount]),[['first',10],['second',20]],'same names do not merge');
 const a=fa(undefined,'expense','money',3);ok(apply(c,[a]).ok&&apply(c,[copy(a)]).ok,'anonymous identical receipt retries');eq(c.GM.guoku.ledgers.money.thisTurnOut,33,'anonymous retry posted once');
 const before=JSON.stringify(c.GM.guoku),bad=apply(c,[fa('first','expense','money',11)]);ok(!bad.ok&&bad.rolledBack,'conflicting ID rejected atomically');eq(JSON.stringify(c.GM.guoku),before,'conflict leaves books untouched');
 ok(apply(c,R.map(k=>fa('three-resource-order','expense',k,1))).ok,'one order can identify independent resource receipts');R.forEach(k=>ok(c.GM.guoku.ledgers[k].sinkDetails.junxiang.some(r=>r.id==='three-resource-order'&&r.amount===1),k+' shares order ID safely'));
});
run('shortage is a common debt with item IDs, zero and negative stocks do not pay',()=>{
 const c=fixture();R.forEach((k,i)=>{c.GM.guoku[k]=[5,0,-4][i];c.GM.guoku.ledgers[k].stock=[5,0,-4][i];c.GM.guoku.ledgers[k].available=[5,0,-4][i];});
 const rows=[fa('short-money','expense','money',20),fa('short-grain','expense','grain',2),fa('short-cloth','expense','cloth',5)];
 ok(apply(c,rows).ok,'partial business execution remains allowed');
 R.forEach((k,i)=>{const b=c.GM.guoku.ledgers[k];eq(b.stock,[0,0,-4][i],k+' bounded stock');eq(b.thisTurnOut,[5,0,0][i],k+' actual paid');eq(b.deficit,[15,2,5][i],k+' unpaid common debt');eq(sum(b.deficitDetails),b.deficit,k+' unpaid detail');});
 const debt=c.GM._fiscalShortfalls.length;ok(apply(c,copy(rows)).ok,'retry partial batch');eq(c.GM._fiscalShortfalls.length,debt,'shortfall report not duplicated');eq(c.GM.guoku.ledgers.money.deficit,15,'shortfall debt not duplicated');
});
run('regional books stay separate, preserve manual postings, and survive next fiscal consumer',()=>{
 const c=fixture();ok(apply(c,[fa('local-in','income','grain',4,'province:r'),fa('local-out','expense','money',10,'province:r')]).ok,'province posts');
 eq(leaf(c).publicTreasury.money.stock,90,'local public stock');eq(leaf(c).fiscal.ledgers.money.stock,90,'local fiscal stock');eq(leaf(c).fiscal.ledgers.grain.thisTurnIn,4,'local grain flow');eq(c.GM.guoku.money,1000,'central funds unchanged');eq(c.GM.guoku.ledgers.money.thisTurnOut,0,'central ledger unchanged');
 ok(c.FiscalEngine.trySpendFromAccount({game:c.GM,ref:'region:r',amounts:{money:5},reason:'工事',transactionId:'local-manual'}).ok,'public treasury manual debit');
 ok(apply(c,[fa('local-next','expense','money',2,'province:r')]).ok,'second province post');eq(leaf(c).publicTreasury.money.thisTurnOut,17,'public combined out');eq(leaf(c).fiscal.ledgers.money.thisTurnOut,17,'fiscal combined out');eq(sum(leaf(c).fiscal.ledgers.money.sinkDetails),17,'all local receipts survive');eq(leaf(c).fiscal.annualExpense,612,'regional raw annual projection');
 c.GM.facs[0].fiscalConfig.fixedExpense.administrativeStaff=[{id:'clerks',name:'州吏',count:1,regionId:'r',funding:'local',monthlyPay:{money:30},sourceTag:'fenglu'}];c.FixedExpense.collect({game:c.GM,turnDays:10});
 eq(leaf(c).publicTreasury.money.thisTurnOut,27,'fixed expense keeps prior postings');eq(leaf(c).fiscal.ledgers.money.thisTurnOut,27,'fixed expense mirrors complete ledger');eq(sum(leaf(c).fiscal.ledgers.money.sinkDetails),27,'fixed and AI detail total');
});
run('palace classification; real thirty-day book stays thirty days; next period archives flows',()=>{
 const c=fixture(),n=c.GM.neitang;n.accounting={turn:2,turnKey:'posting:2',days:30,daysPerMonth:30,daysPerYear:360};n.flowBasis='actual';
 ok(apply(c,[fa('palace','expense','cloth',2,'neitang',{sourceTag:'gongting'})]).ok,'palace posts');eq(n.ledgers.cloth.sinks['宫廷'],2,'palace common class');eq(n.annualClothExpense,24,'thirty-day annual factor');eq(n.accounting.days,30,'same-period length retained');
 c.GM.turn=3;ok(apply(c,[fa('palace-next','income','money',1,'neitang',{sourceTag:'tribute'})]).ok,'next period posts');eq(n.ledgers.cloth.lastTurnOut,2,'old cloth flow archived');eq(n.ledgers.cloth.thisTurnOut,0,'old cloth flow not relabeled as current');eq(n.ledgers.cloth.stock,18,'roll leaves cloth stock');eq(n.accounting.days,10,'new period uses real turn length');eq(n.sources.tribute,36,'palace common annual income');
});
run('whole-batch rollback includes regional and central flow/debt and retry pays once',()=>{
 const c=fixture(),before=JSON.stringify({g:c.GM.guoku,r:leaf(c)}),rows=[fa('before-fail','expense','money',2000),fa('regional-before-fail','expense','grain',5,'province:r'),fa('missing','expense','money',1,'province:absent')];
 const rejected=apply(c,rows);ok(!rejected.ok&&rejected.rolledBack,'missing destination rejects batch');eq(JSON.stringify({g:c.GM.guoku,r:leaf(c)}),before,'stock/period/flows/debt/entries rollback together');
 ok(apply(c,rows.slice(0,2)).ok,'corrected retry commits');eq(c.GM.guoku.ledgers.money.thisTurnOut,1000,'retry one actual debit');eq(c.GM.guoku.ledgers.money.deficit,1000,'retry one debt');eq(leaf(c).fiscal.ledgers.grain.thisTurnOut,5,'retry one regional debit');
});
run('validator compensation shares writer; partial official amounts do not create debt twice',()=>{
 const c=fixture(),rows=[fa('actual','expense','money',400)];c.GM.guoku.money=100;c.GM.guoku.ledgers.money.stock=100;c.GM.guoku.ledgers.money.available=100;
 const extra={shilu_text:'动支1000两。'};ok(apply(c,rows,extra).ok,'nonstrict historical compensation contract');eq(c.GM.guoku.money,0,'spends existing one hundred only');eq(c.GM.guoku.ledgers.money.thisTurnOut,100,'compensation has no fictional outflow');eq(c.GM.guoku.ledgers.money.deficit,900,'official 300 + compensation 600 debt');eq(sum(c.GM.guoku.ledgers.money.deficitDetails),900,'both debt item receipts');
 ok(apply(c,copy(rows),extra).ok,'compensation retry');eq(c.GM.guoku.ledgers.money.deficit,900,'compensation not duplicated on retry');eq(c.GM.guoku.extraExpense.length,2,'one official and one compensation entry');
 const d=fixture(),before=JSON.stringify(d.GM.guoku);const rejected=apply(d,[fa('strict','income','money',100)],{shilu_text:'收入1000两。',_strictValidation:true});ok(!rejected.ok&&rejected.rolledBack,'strict narrative mismatch rejected');eq(JSON.stringify(d.GM.guoku),before,'strict validator compensation rolls back with original payment');
});
run('posting/summary failure cannot be swallowed by nonstrict validator',()=>{
 const c=fixture(),before=JSON.stringify(c.GM.guoku),old=c.FiscalStatement.recordFlow;c.FiscalStatement.recordFlow=()=>{throw Error('injected receipt failure');};
 const rejected=apply(c,[],{shilu_text:'收入1000两。'});ok(!rejected.ok&&rejected.rolledBack,'posting error rejects even nonstrict validator');eq(JSON.stringify(c.GM.guoku),before,'failed receipt rolls back stock and flow');c.FiscalStatement.recordFlow=old;
 const sync=c.FiscalEngine.syncAccountStatement;c.FiscalEngine.syncAccountStatement=()=>{throw Error('injected summary failure');};ok(!apply(c,[fa('after-sync','expense','money',10)]).ok,'summary error rejects');eq(JSON.stringify(c.GM.guoku),before,'summary failure restores full account');c.FiscalEngine.syncAccountStatement=sync;
 ok(apply(c,[fa('after-sync','expense','money',10)]).ok,'retry after sync failure succeeds');eq(c.GM.guoku.ledgers.money.thisTurnOut,10,'failed attempt left no receipt that blocks retry');
});
run('legacy annual category estimates never become real period flows',()=>{
 const c=fixture(true);c.GM.guoku.sources={tianfu:100000};c.GM.guoku.expenses={fenglu:20000};c.GM.guoku.annualIncome=100000;c.GM.guoku.monthlyIncome=100000/12;
 ok(apply(c,[fa('legacy-in','income','money',5),fa('legacy-out','expense','money',10)]).ok,'legacy protocol still works without budget');
 eq(c.GM.guoku.money,995,'legacy money delta');eq(c.GM.guoku.ledgers.money.thisTurnIn,5,'legacy annual revenue not counted as current receipt');eq(c.GM.guoku.ledgers.money.thisTurnOut,10,'legacy annual expense not counted as payment');eq(sum(c.GM.guoku.ledgers.money.sinkDetails),10,'legacy real receipt detail');eq(c.GM.guoku.budgetPreview,undefined,'no fabricated budget');
});
run('faction-only configuration keeps 360-day year across periods and foreign region uses its own units',()=>{
 const c=fixture();delete c.GM.fiscalConfig;delete c.P.fiscalConfig;delete c.GM.scenario;c.GM.turn=3;
 ok(apply(c,[fa('faction-only','income','money',1)]).ok,'faction-only source posts');eq(c.GM.guoku.accounting.daysPerYear,360,'new period retains unified year');eq(c.GM.guoku.accounting.unit.money,'贯','faction-only unit');eq(c.GM.guoku.annualIncome,36,'faction-only annual projection');
 const bcfg=copy(c.GM.facs[0].fiscalConfig);bcfg.unit={money:'文',grain:'斛',cloth:'端'};c.GM.facs.push({id:'B',name:'乙',fiscalConfig:bcfg,officeTree:[]});c.GM.adminHierarchy.B={factionId:'B',divisions:[{id:'b',name:'异国本州',publicTreasuryInit:{money:100,grain:10,cloth:5}}]};c.GM.publicTreasuryConfig.accounts.push({id:'region:b',name:'乙州库',kind:'physical',scope:'regional',factionId:'B',source:{kind:'region',id:'b'}});c.FiscalEngine.initializePublicTreasuries({game:c.GM});
 const central=c.GM.guoku.money;ok(apply(c,[fa('foreign','income','money',2,'province:b')]).ok,'formal province resolver allows foreign stable ID');const b=c.GM.adminHierarchy.B.divisions[0];eq(b.publicTreasury.money.stock,102,'foreign local stock');eq(b.fiscal.unit.money,'文','foreign statement uses foreign currency');eq(b.publicTreasury.accounting.unit.money,'文','foreign period metadata uses foreign currency');eq(b.fiscal.annualIncome,72,'foreign actual annual projection');eq(c.GM.guoku.money,central,'foreign local receipt is not player receipt');
});
console.log('[smoke-fiscal-ai-posting] PASS '+cases+' cases / '+checks+' assertions');
