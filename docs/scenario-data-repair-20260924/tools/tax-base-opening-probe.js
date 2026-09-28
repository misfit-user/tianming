// 一次仅一个真实开局 VM；--before 记录本轮审查前时序，其余验证开局库存及财政回合。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'../../..'),DIR=path.resolve(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x));
function helpers(){const dir=path.join(ROOT,'web/scripts'),file=path.join(dir,'smoke-start-game-data-integrity.js'),s=fs.readFileSync(file,'utf8').replace(/^#![^\n]*\n/,'');return new Function('require','process','__dirname','__filename','module','exports',s.slice(0,s.indexOf('// 天启官方地图'))+'\nreturn {loadGame,disposeGame:function(){disposeGame();}};')(require,process,dir,file,{exports:{}},{});}
function balances(g){const out={};for(const key of ['guoku','neitang']){const a=g[key]||{};out[key]={};for(const r of ['money','grain','cloth']){const l=(a.ledgers||{})[r]||{};out[key][r]={scalar:a[r],stock:l.stock,deficit:l.deficit||0,income:l.thisTurnIn||0,expense:l.thisTurnOut||0};}}return out;}
async function run(key,before){
 const s=JSON.parse(fs.readFileSync(path.join(ROOT,'scenarios',require('../data/'+key+'-tax-base').scenario),'utf8')),h=helpers(),c=h.loadGame(null),trace=[];
 if(process.argv.includes('--trace-stocks')){const init=c.GuokuEngine.initFromDynasty;c.GuokuEngine.initFromDynasty=function(){const r=init.apply(this,arguments);for(const key of ['money','grain','cloth']){const l=c.GM.guoku.ledgers[key];let v=l.stock;Object.defineProperty(l,'stock',{enumerable:true,configurable:true,get:()=>v,set:x=>{if(v!==x)console.log('STOCK '+key+' '+v+' -> '+x+' '+new Error().stack);v=x;}});}return r;};}
 vm.runInContext('var __seed=840;Math.random=function(){__seed=(Math.imul(__seed,1664525)+1013904223)>>>0;return __seed/4294967296;};',c);
 for(const name of ['CascadeTax','FixedExpense']){const collect=c[name].collect;c[name].collect=function(o){const entry={name,turn:c.GM.turn,requestedDays:o&&o.turnDays,days:c._getDaysPerTurn(),before:balances(c.GM)};const r=collect.call(this,o);entry.result={ok:r.ok,skipped:r.skipped};entry.after=balances(c.GM);trace.push(entry);return r;};}
 c.__source=s;vm.runInContext('P.scenarios=(P.scenarios||[]).filter(s=>s.id!==__source.id);P.scenarios.push(__source);P.ai.key="";P.ai.url="";P.ai.model="";',c);
 vm.runInContext('doActualStart('+JSON.stringify(s.id)+')',c,{timeout:600000});await new Promise(r=>setTimeout(r,1000));assert(c.__entered,'开局未完成');
 const days=c._getDaysPerTurn(),g=c.GM,report={scenario:s.id,days,method:'doActualStart; CascadeTax/FixedExpense before turn++; GuokuEngine/NeitangEngine tick after turn++; fiscal subsystem only, no AI, war or population simulation',authored:{money:s.guoku.initialMoney,grain:s.guoku.initialGrain,cloth:s.guoku.initialCloth},opening:balances(g),display:clone({income:g.guoku.monthlyIncome,expense:g.guoku.monthlyExpense,lastFixed:Object.fromEntries(Object.entries(g._lastFixedExpense||{}).filter(([k])=>k!=="budget")),flowBasis:g.guoku.flowBasis}),startupTrace:clone(trace)};
 if(!before){for(const k of ['money','grain','cloth']){assert.equal(g.guoku[k],s.guoku['initial'+k[0].toUpperCase()+k.slice(1)],key+'开局存量被预扣 '+k);assert.equal(g.guoku.ledgers[k].thisTurnIn||0,0);assert.equal(g.guoku.ledgers[k].thisTurnOut||0,0);}assert(!trace.some(t=>t.result.ok),'开局发生真实征收');assert.equal(g._lastCascadeTaxTurn,undefined);assert.equal(g._lastFixedExpenseTurn,undefined);}
 if(!before){const savedStocks=JSON.stringify(balances(g));g._isFreshNewGame=false;c.enterGame();assert.equal(JSON.stringify(balances(g)),savedStocks,'未过回合新存档重入发生库存变化');assert(!trace.some(t=>t.result.ok),'新存档重入发生预结算');report.savedOpeningReentryUnchanged=true;}
 report.periods=[];
 for(let i=0;i<(before?1:12);i++){
  const quote=!before?c.CascadeTax.previewRevenue({game:g,turnDays:days}):null;
  const pre=balances(g),income=c.CascadeTax.collect({game:g,turnDays:days}),expense=c.FixedExpense.collect({game:g,turnDays:days});
  if(!before){assert(income.ok&&expense.ok,'首月或后续财政漏结');for(const k of ['money','grain','cloth'])assert(Math.abs(income.totals.central[k]-quote.totals.central[k])<.0002,'首期/本期与只读预估不同 '+k);const once=JSON.stringify(balances(g));assert(!c.CascadeTax.collect({game:g,turnDays:days}).ok);assert(!c.FixedExpense.collect({game:g,turnDays:days}).ok);assert.equal(JSON.stringify(balances(g)),once,'同回合重征/重扣');}
  const row={turn:g.turn,before:pre,afterFixed:balances(g),income:income.ok?clone({central:income.totals.central,localRetain:income.totals.localRetain,nominal:income.totals.nominal}):income,expense:expense.ok?clone(expense.turnExpense):expense};g.turn++;
  if(!before){c.GuokuEngine.tick({turn:g.turn,monthRatio:days/30,_monthRatio:days/30});c.NeitangEngine.tick({turn:g.turn,monthRatio:days/30,_monthRatio:days/30});}
  row.after=balances(g);report.periods.push(row);
 }
 report.firstTurnTrace=trace.slice(report.startupTrace.length);h.disposeGame();
 report.forecastMatchesCollection=!before;report.openingTransferReceipts=Object.keys(g._publicTreasuryOpeningTransfers||{});
 const file=path.join(DIR,'reports','tax-base-opening-'+key+(before?'-before':'-after')+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log('PASS '+key+' opening='+report.opening.guoku.money.scalar+' source='+report.authored.money+' month='+report.display.income+'/'+report.display.expense);
}
if(require.main===module)run(process.argv[2],process.argv.includes('--before')).then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1);});
module.exports={helpers,balances,run};
