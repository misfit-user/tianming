// Production tax contract: units, negative output shock, leaf scope, preview/collection and saved worlds.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
let count=0;const eq=(a,b,m)=>{assert.ok(Math.abs(a-b)<1e-6,`${m}: ${a} != ${b}`);count++;};
const c={console,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},document:{readyState:'loading',addEventListener(){}},P:{},GM:{},TM:{}};c.window=c;
vm.createContext(c);
for(const f of ['tm-fiscal-statements.js','tm-fiscal-engine.js','tm-guoku-engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c,{filename:f});
const clone=x=>JSON.parse(JSON.stringify(x));
function leaf(id,values){return {id,name:id,populationDetail:{mouths:10000,households:2000,ding:2500},prosperity:50,corruption:0,
  tags:{saltRegion:true,mineralRegion:true,hasPort:true},economyBase:Object.assign({farmland:10000,saltProduction:10000,mineralProduction:2000,maritimeTradeVolume:3000,quota:100},values),
  carryingCapacity:{currentLoad:1},fiscal:{compliance:1,skimmingRate:0,autonomyLevel:0}};}
function setup(unified=false){
 const taxes=[{id:'salt',name:'盐钞',base:'saltProduction',productionTax:{unitPrice:0.06,quantityUnit:'斤'},rate:1,annual:true,sourceTag:'yanlizhuan'},
   {id:'mine',base:'mineralProduction',productionTax:{unitPrice:1},rate:0.2,annual:true,sourceTag:'mining'},
   {id:'ship',base:'maritimeTradeVolume',productionTax:{unitPrice:1},rate:0.1,annual:true,sourceTag:'shipaiShui'},
   {id:'quota',base:'quota',rate:1,annual:true,sourceTag:'qita'}];
 c.P={};c.scriptData={};c.findScenarioById=()=>null;
 c.GM={turn:1,policies:{},chars:[],facs:[],guoku:{},fiscalConfig:{productionTaxVersion:1,taxList:taxes,customTaxes:[],logisticsLoss:0,centralLocalRules:{perTax:{},defaultPerTax:{qiyun:0.75,cunliu:0.25}},...(unified?{accounting:{schema:'tm-fiscal-ledger/2'}}:{})},
   adminHierarchy:{player:{divisions:[{id:'parent',economyBase:{saltProduction:99999999},children:[leaf('a'),leaf('b',{saltProduction:0,mineralProduction:0,maritimeTradeVolume:0,quota:0})]}]}}};
 return c.GM.adminHierarchy.player.divisions[0].children[0];
}
function preview(options={}){return c.CascadeTax.previewRevenue(Object.assign({game:c.GM},options));}
function row(p,id){return p.regions.flatMap(r=>r.taxes).filter(r=>r.id===id).reduce((a,r)=>a+r.nominal,0);}
for(const unified of [false,true]){
 let d=setup(unified),json=JSON.stringify(c.GM),p=preview();
 assert.equal(JSON.stringify(c.GM),json,'preview is read only');count++;
 eq(row(p,'salt'),600,'salt pounds converted into receipts');eq(row(p,'mine'),400,'mineral value fraction');eq(row(p,'ship'),300,'cargo fraction');
 eq(p.totals.central.money,1050,'central share, zero leaf, parent not double counted');
 const r=c.CascadeTax.collect({game:c.GM,force:true,turnDays:unified?360:365});
 eq(r.totals.central.money,p.totals.central.money,'collection matches preview');eq(r.totals.localRetain.money,p.totals.localRetain.money,'retention matches preview');
 for(const f of [0.8,1.2]){
   d=setup(unified);c.CascadeTax._settleLandFlow(d,{fiscalConfig:c.GM.fiscalConfig});
   d.economyBase.saltProduction*=f;d.economyBase.mineralProduction*=f;d.economyBase.maritimeTradeVolume*=f;
   p=preview();eq(row(p,'salt'),600*f,'salt shock '+f);eq(row(p,'mine'),400*f,'mine shock '+f);eq(row(p,'ship'),300*f,'ship shock '+f);eq(row(p,'quota'),100,'quota unchanged');
   for(let i=0;i<6;i++){c.GM.turn++;c.CascadeTax.collect({force:true,turnDays:unified?360:365});eq(d.economyBase.saltProduction,10000*f,'output stable through collection');}
 }
 d=setup(unified);d.populationDetail.mouths*=1.2;eq(row(preview({settleProduction:false}),'salt'),600,'population alone is not the tax base');
 d=setup(unified);c.GM.fiscalConfig.taxList[0].productionTax.regionIds=['elsewhere'];eq(row(preview(),'salt'),0,'unselected district is not taxed');
 c.GM.fiscalConfig.taxList[3].regionIds=['elsewhere'];eq(row(preview(),'quota'),0,'scope also restricts retained legacy tax');
 d=setup(unified);c.GM.fiscalConfig.taxList[0].productionTax.unitCost=0.01;eq(row(preview(),'salt'),500,'explicit supported unit cost deducted once');
}
let d=setup();d.economyBase.saltProduction=0;eq(row(preview(),'salt'),0,'zero not replaced by population');
delete d.economyBase.saltProduction;eq(row(preview(),'salt'),0,'missing declared quantity does not invent taxable production');
d=setup();c.CascadeTax._settleLandFlow(d,{fiscalConfig:c.GM.fiscalConfig});d.populationDetail.mouths=8000;
c.CascadeTax._settleLandFlow(d,{fiscalConfig:c.GM.fiscalConfig});eq(d.economyBase.saltProduction,8000,'authored production follows population driver');
const restored=clone(c.GM);c.GM=restored;eq(row(preview(),'salt'),480,'new save roundtrip retains production state');
d=setup();c.GM.fiscalConfig.customTaxes=[{id:'extra',name:'定额',formulaType:'flat',amount:1000}];
c.GM.population={national:{mouths:20000}};c.P.fiscalConfig=c.GM.fiscalConfig;
c.GuokuEngine.ensureModel();const forecast=preview();let total=0;
for(const fn of Object.values(c.GuokuEngine.Sources))total+=fn();
eq(total,1800,'known central total includes the 1000 flat tax exactly once');
eq(total,forecast.totals.central.money,'guoku sources match central forecast including custom taxes once');
eq(c.GuokuEngine.computeTaxFlow(99999999).actualReceived,forecast.totals.central.money,'fallback does not apply second corruption loss');
// A saved legacy table wins over newly installed scenario defaults, P and scriptData.
d=setup();const updated=clone(c.GM.fiscalConfig);c.GM.fiscalConfig={taxes:{yanlizhuan:true},taxList:[{id:'old',base:'consumption',rate:0.2,annual:true}],customTaxes:[],logisticsLoss:0,centralLocalRules:{perTax:{},defaultPerTax:{qiyun:1,cunliu:0}}};
c.GM.sid='old-save';c.findScenarioById=()=>({fiscalConfig:updated});c.P.fiscalConfig=updated;c.scriptData.fiscalConfig=updated;
c.GM.fiscalConfig.taxList[0].regionIds=['not-this-region'];
eq(row(preview(),'old'),4000,'legacy saved table and previously ignored scope remain authoritative');eq(row(preview(),'salt'),0,'no new scenario tax leaks into old save');
delete c.GM.fiscalConfig.taxList;eq(row(preview(),'salt_iron'),4000,'old taxes-switch save retains DEFAULT_TAXES path');
// Render the real province function; its money amounts must be the same quotes as collection.
const province=fs.readFileSync(path.join(__dirname,'../tm-endturn-province.js'),'utf8');
vm.runInContext(province,c,{filename:'tm-endturn-province.js'});
c.escHtml=x=>String(x);c._peN=x=>String(x);c._peU=()=>({money:'贯',grain:'石',cloth:'匹'});
d=setup();d.tags.horseRegion=true;d.economyBase.horseProduction=900;
const html=c._peRenderRevenueBreakdown(d);
assert.ok(html.includes('名义 600 · 地方留用 150')&&html.includes('>450 <span'),'province salt quote matches assessment and remittance');count++;
assert.ok(!html.includes('马征')&&!html.includes('45000'),'horse production is never displayed as invented cash tax');count++;
assert.ok(html.includes('年度上解预计'),'forecast is labeled as estimate');count++;
assert.ok(html.includes('税基 10000 斤'),'province reads declared physical quantity and unit');count++;
// Region tax controls (including duty overrides and disasters) share the actual budget path.
d=setup(true);d.fiscal.taxOverrides={salt:{rate:0.5}};
let q=preview(),budget=c.CascadeTax.previewBudget({game:c.GM,turnDays:360});
eq(row(q,'salt'),300,'division override applied');eq(q.totals.central.money,budget.totals.central.money,'ledger/2 preview reuses actual budget computation');
c.GM.fiscalConfig.taxList.find(t=>t.id==='quota').taxBasePolicy='retained-assessment';
assert.ok(c._peRenderRevenueBreakdown(d).includes('账额 100 贯'),'retained assessments are shown as account assessments');count++;
d=setup();c.GM.activeDisasters=[{region:'a',category:'flood',severity:'severe'}];q=preview();
let actual=c.CascadeTax.collect({force:true,turnDays:365});eq(q.totals.central.money,actual.totals.central.money,'active disaster forecast matches collection');
d=setup();c.TM.TaxPolicy={effectiveTax:(g,div,t)=>Object.assign({},t,{rate:t.rate*2})};
q=preview();actual=c.CascadeTax.collect({force:true,turnDays:365});
eq(row(q,'salt'),1200,'tax policy affects nominal rate once');eq(q.totals.central.money,actual.totals.central.money,'legacy preview does not apply the policy twice');
delete c.TM.TaxPolicy;
d=setup();const authored=clone(c.GM.fiscalConfig);c.GM.fiscalConfig={};c.GM.sid='new-game';c.GM._isFreshNewGame=true;c.findScenarioById=()=>({fiscalConfig:authored});
c.FiscalEngine.enableTaxesByDynasty(c.GM);eq(c.GM.fiscalConfig.productionTaxVersion,1,'fresh world retains scenario tax declaration before switches normalize');
eq(row(preview(),'salt'),600,'fresh-world taxList wins over DEFAULT_TAXES');
c.GM.fiscalConfig={taxes:{yanlizhuan:true}};c.GM._isFreshNewGame=false;
c.FiscalEngine.enableTaxesByDynasty(c.GM);assert.ok(!c.GM.fiscalConfig.productionTaxVersion,'load lifecycle does not seed new fiscal schema into old save');count++;
// Real legacy shape: GM stored only switches. Newly installed sources must preserve old custom taxes and allocation too.
d=setup();c.GM.fiscalConfig={taxes:{},taxesEnabled:{}};c.GM.sid='switch-only-save';c.GM._isFreshNewGame=false;c.GM.population={national:{mouths:20000}};
const oldConfig={taxList:null,taxes:[{id:'authored-old',base:'consumption',rate:0.04}],customTaxes:[{id:'custom',formulaType:'flat',amount:1000}],centralLocalRules:{perTax:{salt_iron:{qiyun:0.9,cunliu:0.1}},defaultPerTax:{qiyun:0.7,cunliu:0.3}},taxesEnabled:{juanNa:false},logisticsLoss:0};
c.P.fiscalConfig=oldConfig;c.findScenarioById=()=>({fiscalConfig:oldConfig});
const beforeLegacy=preview();c.GuokuEngine.ensureModel();const beforeOther=c.GuokuEngine.Sources.qita();
const newConfig=Object.assign({},authored,{centralLocalRules:{perTax:{salt_iron:{qiyun:1,cunliu:0}}},customTaxes:[],legacyTaxConfig:oldConfig});
c.P.fiscalConfig=newConfig;c.findScenarioById=()=>({fiscalConfig:newConfig});
const afterLegacy=preview();eq(afterLegacy.totals.central.money,beforeLegacy.totals.central.money,'old switch-only save central allocation and custom tax preserved');
eq(afterLegacy.totals.localRetain.money,beforeLegacy.totals.localRetain.money,'old switch-only save local retention preserved');
eq(row(afterLegacy,'custom'),1000,'old custom tax is not dropped by new scenario');
eq(c.GuokuEngine.Sources.qita(),beforeOther,'old eight-source fallback reads legacy custom taxes');
console.log('PASS production tax base: '+count+' assertions');
