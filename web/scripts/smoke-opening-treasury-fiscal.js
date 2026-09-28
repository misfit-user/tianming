// Opening forecast vs first actual fiscal period; saved opening, old saves and atomic transfers.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(__dirname,'smoke-public-treasury-custody.js'),'utf8').replace(/^#![^\n]*\n/,''),cut=source.indexOf('let c=fixture(),');
assert(cut>0);const fixture=new Function('require','__dirname',source.slice(0,cut)+'\nreturn fixture;')(require,__dirname);
let checks=0;const ok=(a,m)=>{assert(a,m);checks++;},copy=x=>JSON.parse(JSON.stringify(x));
function setup(unified){
 const c=fixture(),G=c.GM;
 vm.runInContext(fs.readFileSync(path.join(root,'tm-guoku-engine.js'),'utf8'),c);
 const cfg=G.fiscalConfig;cfg.taxList=[{id:'land',name:'田赋',base:'arableLand',rate:.1,annual:true,storeAs:'money',sourceTag:'tianfu'}];
 cfg.centralLocalRules={perTax:{},defaultPerTax:{qiyun:1,cunliu:0}};
 if(!unified){delete cfg.accounting;delete G.publicTreasuryConfig;}
 G.facs[0].fiscalConfig=copy(cfg);return c;
}
function stock(c){const g=c.GM;return ['guoku','neitang'].map(key=>['money','grain','cloth'].map(k=>g[key].ledgers[k].stock)).concat(g.officeTree.map(d=>d.publicTreasury?['money','grain','cloth'].map(k=>d.publicTreasury[k].stock):[]));}
function settle(c){return [c.CascadeTax.collect({game:c.GM,turnDays:30}),c.FixedExpense.collect({game:c.GM,turnDays:30})];}
for(const unified of [false,true]){
 let c=setup(unified);c.FiscalEngine.initializePublicTreasuries({game:c.GM});settle(c);const reference=stock(c);
 c=setup(unified);let G=c.GM;G._isFreshNewGame=true;
 c.FiscalEngine.initializePublicTreasuries({game:G});ok(G.guoku.money===1000,'new opening reserve is authored stock');
 const before=JSON.stringify(stock(c)),world=JSON.stringify(G.adminHierarchy),offices=JSON.stringify(G.officeTree);
 const plan=c.GuokuEngine.previewOpeningFiscal({game:G,turnDays:30});ok(!!plan,'opening has a forecast');
 ok(JSON.stringify(stock(c))===before,'forecast cannot move any stock');ok(JSON.stringify(G.adminHierarchy)===world,'forecast cannot settle production');ok(JSON.stringify(G.officeTree)===offices,'forecast cannot pay salaries or transfer offices');
 ok(G._lastCascadeTaxTurn==null&&G._lastFixedExpenseTurn==null,'forecast never marks the first period collected');ok(G.guoku.flowBasis==='forecast','opening values labeled forecast');
 const state=JSON.stringify(G);c.GuokuEngine.previewOpeningFiscal({game:G,turnDays:30});ok(JSON.stringify(G)===state,'repeated forecast is idempotent');
 G=c.GM=copy(G);G._isFreshNewGame=false;
 ok(c.GuokuEngine.openingFiscalPending(G),'saved unplayed opening still defers settlement');c.FiscalEngine.initializePublicTreasuries({game:G});c.GuokuEngine.previewOpeningFiscal({game:G,turnDays:30});ok(JSON.stringify(stock(c))===before,'reload cannot pre-charge the first month');
 if(unified){let threw=false;try{c.CascadeTax.collect({game:G,turnDays:30,_faultInjector(){throw Error('rollback');}});}catch(e){threw=true;}
  ok(threw,'fault injected after opening transfers');ok(JSON.stringify(stock(c))===before,'failed first settlement rolls back all transferred stocks');ok(!G._publicTreasuryOpeningTransfers||!Object.keys(G._publicTreasuryOpeningTransfers).length,'failed first settlement leaves no transfer receipt');ok(G.guoku.openingFiscalPending,'failed first settlement remains pending');}
 const result=settle(c);ok(result.every(r=>r.ok),'first period tax and expense execute once');ok(JSON.stringify(stock(c))===JSON.stringify(reference),'same opening state: old immediate and deferred first settlement have identical stocks');
 ok(!G.guoku.openingFiscalPending&&G.guoku.flowBasis==='actual','actual collection replaces the forecast marker');const once=JSON.stringify(stock(c));ok(settle(c).every(r=>!r.ok),'retry cannot charge the first month twice');ok(JSON.stringify(stock(c))===once,'retry leaves stocks unchanged');
 const receipts=Object.keys(G._publicTreasuryOpeningTransfers||{}).length;G.turn++;ok(settle(c).every(r=>r.ok),'next fiscal month is not skipped');ok(Object.keys(G._publicTreasuryOpeningTransfers||{}).length===receipts,'next month does not repeat opening allocations');
 c=setup(unified);G=c.GM;const legacy=JSON.stringify(G);ok(!c.GuokuEngine.openingFiscalPending(G)&&c.GuokuEngine.previewOpeningFiscal({game:G})===null,'old save does not acquire new opening semantics');ok(JSON.stringify(G)===legacy,'old save state remains byte-identical');
}
// NativeFiscal keeps its separate opening contract, even with a fresh-world marker.
const native=setup(true);native.GM._isFreshNewGame=true;native.GM.startContext={schemaVersion:'tm-start-context/1'};native.TM.NativeFiscal={enabled:()=>true};
ok(native.GuokuEngine.previewOpeningFiscal({game:native.GM})===null,'native opening is excluded from this forecast path');
ok(native.FiscalEngine.initializePublicTreasuries({game:native.GM}).ok,'native custody initialization still succeeds');
ok(native.GM.guoku.money===900&&native.GM.officeTree[0].publicTreasury.money.stock===100,'native opening allocations keep their existing timing');
console.log('PASS opening treasury fiscal: '+checks+' assertions');
