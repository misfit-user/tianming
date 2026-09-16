#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),acorn=require('acorn');
const WEB=path.resolve(__dirname,'..');let checks=0;
function ok(v,m){checks++;assert.ok(v,m);}function eq(a,b,m){checks++;assert.strictEqual(a,b,m);}function near(a,b,m){ok(Math.abs(a-b)<.0001,m+': '+a+' / '+b);}
const fixtureSource=fs.readFileSync(path.join(__dirname,'smoke-treasury-account-books.js'),'utf8').replace(/^#![^\n]*\n/,''),fixtureEnd=fixtureSource.indexOf('let {c,scenario,elements}=fixture()');assert(fixtureEnd>0);
const fixture=new Function('require','__dirname',fixtureSource.slice(0,fixtureEnd)+'\nreturn fixture;')(require,__dirname);
const startSource=fs.readFileSync(path.join(WEB,'tm-patches-start.js'),'utf8'),ast=acorn.parse(startSource,{ecmaVersion:'latest',sourceType:'script'});
function named(name){const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(node,'production function '+name);return startSource.slice(node.start,node.end);}
{
 const {c,scenario}=fixture(),preview=c.CascadeTax.previewBudget,apply=c.CascadeTax.applyBudgetSnapshot,sync=c.FiscalEngine.syncAccountStatement,previews=[],applied=[],inner=[],borderCalls=[];
 c._tmStartRefreshFormalShell=()=>{};c._tmStartHasRegions=()=>true;c.GM._useAIGeo=true;
 c.CascadeTax.previewBudget=function(opts){const b=preview(opts);previews.push(b);return b;};
 c.CascadeTax.applyBudgetSnapshot=function(opts){applied.push(opts.budget);return apply(opts);};
 c.FiscalEngine.syncAccountStatement=function(opts){inner.push(opts.budget);return sync(opts);};
 c.BorderRisk={prime(G){borderCalls.push(G);}};
 vm.runInContext(named('_tmStartDynastyContext')+'\n'+named('_tmStartPrimeFormalRuntime'),c,{filename:'actual-startup-prime.js'});
 const beforeStocks={central:c.GM.guoku.money,internal:c.GM.neitang.money};
 c._tmStartPrimeFormalRuntime(c.GM.sid,scenario,'before-start-hook');
 eq(previews.length,1,'one exported preview in first production prime');eq(applied.length,1,'one snapshot write in first prime');ok(applied[0]===previews[0],'snapshot consumes exact budget object already previewed');eq(inner.length,1,'real inner initialization synchronizes once');ok(inner[0]===previews[0],'inner initializer wrapper forwards exact same stage budget');
 near(c.GM.guoku.money,beforeStocks.central,'projection never increases central stock');near(c.GM.neitang.money,beforeStocks.internal,'projection never increases inner stock');near(c.GM.neitang.monthlyIncome,300,'reuse preserves allowance amount');near(c.GM.neitang.ledgers.money.thisTurnIn,0,'reuse still does not execute allowance');
 // A start hook can change fiscal inputs between the two required passes.
 for(const cfg of [c.GM.fiscalConfig,c.GM.facs[0].fiscalConfig]){cfg.fixedExpense.recurringExpenses.find(r=>r.id==='allotment').monthly.money=900;cfg.fixedExpense.recurringExpenses.find(r=>r.id==='palace').monthly.money=900;}
 c._tmStartPrimeFormalRuntime(c.GM.sid,scenario,'before-enter-local');
 eq(previews.length,2,'second stage computes a fresh budget');eq(applied.length,2,'second stage writes its own new snapshot');ok(previews[1]!==previews[0]&&applied[1]===previews[1],'no cache crosses initialization stages');eq(inner.length,1,'already initialized inner stock is not initialized twice');near(c.GM.neitang.monthlyIncome,900,'second-stage input change reaches shared fields');eq(borderCalls.length,2,'both existing border prime passes remain untouched');near(c.GM.neitang.money,beforeStocks.internal,'later fiscal changes remain a forecast');
}
{
 const {c,scenario}=fixture(),budget=c.CascadeTax.previewBudget({game:c.GM,faction:'player',turnDays:10}),original=c.FiscalEngine.syncAccountStatement,seen=[];
 c.FiscalEngine.syncAccountStatement=function(opts){seen.push(opts.budget);return original(opts);};
 const before=JSON.stringify(budget);c.NeitangEngine.initFromDynasty('唐','late',scenario,{budget});ok(seen.at(-1)===budget,'direct optional initializer accepts same-period budget');eq(JSON.stringify(budget),before,'initializer does not mutate provided budget');
 for(const kind of ['other-turn','other-days','other-scenario','other-faction']){
   const stale=JSON.parse(JSON.stringify(budget));if(kind==='other-turn')stale.period.turn=2;if(kind==='other-days')stale.period.days=30;if(kind==='other-scenario')stale.period.turnKey='other:1';if(kind==='other-faction')stale.factionId='foreign';
   c.NeitangEngine.initFromDynasty('唐','late',scenario,{budget:stale});eq(seen.at(-1),null,kind+' is not reused');near(c.GM.neitang.monthlyIncome,300,kind+' falls back to current calculation');
 }
 c.NeitangEngine.initFromDynasty('唐','late',scenario);eq(seen.at(-1),null,'existing three-argument calls remain compatible');near(c.GM.neitang.monthlyIncome,300,'three-argument path retains current budget');
}
console.log('[smoke-startup-budget-reuse] PASS '+checks+' assertions; no native startup or AI run');
