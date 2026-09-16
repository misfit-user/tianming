#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..'),REPO=path.resolve(ROOT,'..');let checks=0;
const ok=(v,m)=>{assert(v,m);checks++;},near=(a,b,m)=>ok(Math.abs(a-b)<.0001,m+': '+a+' / '+b),clone=x=>JSON.parse(JSON.stringify(x));
const source=fs.readFileSync(path.join(__dirname,'smoke-treasury-account-books.js'),'utf8').replace(/^#![^\n]*\n/,''),end=source.indexOf('let {c,scenario,elements}=fixture()');assert(end>0);
const fixture=new Function('require','__dirname',source.slice(0,end)+'\nreturn fixture;')(require,__dirname);
const load=(c,f)=>vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});
const headers=['回合速察','三账库存','岁入分项','岁出分项','如何措置'];
function legacyFixture(s){
 const elements={};for(const id of ['neitang-body','neitang-subtitle'])elements[id]={innerHTML:'',textContent:''};
 const days=s.gameSettings.daysPerTurn,pi=s.playerInfo,G={sid:s.id,turn:1,playerInfo:clone(pi),facs:[{id:pi.factionName,name:pi.factionName}],chars:[],officeTree:[],armies:[],adminHierarchy:{},fiscalConfig:clone(s.fiscalConfig||{}),guoku:{},neitang:{},vars:{}};
 const c={GM:G,P:{fiscalConfig:clone(s.fiscalConfig||{}),playerInfo:clone(pi),time:{daysPerTurn:days}},Math,Date,JSON,console:{log(){},warn(){},error(){}},findScenarioById:()=>s,_getDaysPerTurn:()=>days,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},fetch(){throw Error('network forbidden');},document:{getElementById:id=>elements[id],querySelector:()=>null,addEventListener(){}},_escHtml:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')};c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-field-pipelines.js','tm-public-treasury.js','tm-fiscal-statements.js','tm-fiscal-engine.js','tm-guoku-engine.js','tm-neitang-engine.js','tm-neitang-panel.js'])load(c,f);
 c.GuokuEngine.initFromDynasty(s.dynasty,s.dynastyPhaseHint,s);c.NeitangEngine.initFromDynasty(s.dynasty,s.dynastyPhaseHint,s);return {c,elements};
}
const captions=[];
for(const file of ['天启七年·九月（官方）.json','绍宋·建炎元年八月（官方）.json']){
 const s=JSON.parse(fs.readFileSync(path.join(REPO,'scenarios',file),'utf8')),{c,elements}=legacyFixture(s),n=c.GM.neitang;
 for(const k of ['money','grain','cloth']){near(n.monthlyIncomeEstimate[k],s.neitang.monthlyIncomeEstimate[k],file+' preserves original monthly income key '+k);near(n.monthlyExpenseEstimate[k],s.neitang.monthlyExpenseEstimate[k],file+' preserves monthly expense key '+k);near(n.ledgers[k].thisTurnIn,0,file+' opening actual remains zero '+k);}
 ok(n.unit.money===s.fiscalConfig.unit.money,file+' uses source fiscal unit');near(n.annualIncome,s.neitang.monthlyIncomeEstimate.money*12,file+' annual field keeps source monthly budget');
 const before=JSON.stringify(c.GM);c.renderNeitangPanel();ok(JSON.stringify(c.GM)===before,file+' renderer pure');
 ok(headers.every(x=>elements['neitang-body'].innerHTML.includes('tr-section-name">'+x)),file+' common panel');ok(elements['neitang-subtitle'].textContent.startsWith('预计'),file+' opening labeled forecast');
 const statement=c.FiscalEngine.readAccountStatement({game:c.GM,account:n,scope:'internal'});near(statement.account.ledgers.money.thisTurnIn,s.neitang.monthlyIncomeEstimate.money,file+' displayed ledger consumes the same planned total');
 captions.push(headers.filter(x=>elements['neitang-body'].innerHTML.includes('tr-section-name">'+x)));
 // Keep original settlement rule, but use deterministic declared component amounts to test the units.
 for(const k of Object.keys(c.NeitangEngine.Sources))c.NeitangEngine.Sources[k]=()=>0;
 for(const k of Object.keys(c.NeitangEngine.Expenses))c.NeitangEngine.Expenses[k]=()=>0;
 c.NeitangEngine.Sources.huangzhuang=()=>12000;c.NeitangEngine.Expenses.gongting=()=>6000;
 const opening=n.money;c.NeitangEngine.monthlySettle(1);
 near(n.money,opening+500,file+' does not alter actual legacy collection');near(n.ledgers.money.thisTurnIn,1000,file+' actual monthly inflow');near(Object.values(n.ledgers.money.sources).reduce((a,b)=>a+b,0),1000,file+' source detail period is month not year');
 near(n.ledgers.money.sources.huangzhuang,1000,file+' common English source category');near(n.ledgers.money.sinks['宫廷'],500,file+' common Chinese expense category');near(n.sources.huangzhuang,12000,file+' annual category is still annual');
 ok(n.flowBasis==='actual',file+' posted flow is actual');ok(n.history.monthly.at(-1).periodDays===30,file+' history carries actual period');
 for(const k of ['grain','cloth'])near(Object.values(n.ledgers[k].sources).reduce((a,b)=>a+b,0),n.ledgers[k].thisTurnIn,file+' real resource detail reconciles '+k);
}
{
 const {c,elements,scenario}=fixture(),n=c.GM.neitang;
 ok(!('allowanceEstimate' in n)&&!('expenseEstimate' in n),'no renamed monthly estimates');near(n.monthlyIncomeEstimate.money,scenario.neitang.monthlyIncomeEstimate.money,'original source estimate remains available');
 const start=JSON.stringify(c.GM);c.renderNeitangPanel();ok(JSON.stringify(c.GM)===start,'declared renderer pure');
 ok(headers.every(x=>elements['neitang-body'].innerHTML.includes('tr-section-name">'+x)),'declared uses the same panel');captions.push(headers.filter(x=>elements['neitang-body'].innerHTML.includes('tr-section-name">'+x)));
 let statement=c.FiscalEngine.readAccountStatement({game:c.GM,account:n,scope:'internal'});
 near(statement.account.monthlyIncome,300,'same actual funding budget takes priority over stale authored estimate');near(statement.account.turnIncome,100,'ten-day opening projection');near(n.ledgers.money.thisTurnIn,0,'projection not credited');
 near(statement.account.sources.guokuTransfer,3600,'canonical annual income category');near(statement.account.sourcesDetail.guokuTransfer[0].amount,3600,'money detail annual');ok(Math.abs(statement.sourceDetailsByResource.grain.guokuTransfer[0].amount-240)<.002,'grain detail annual within four-decimal period rounding');
 c.CascadeTax.collect({turnDays:10});c.FixedExpense.collect({turnDays:10});c.NeitangEngine.monthlySettle(1/3);
 near(n.turnIncome,100,'actual ten-day income');near(n.monthlyIncome,300,'actual monthly normalization');near(n.sources.guokuTransfer,3600,'actual category remains annual');ok(Array.isArray(n.sourcesDetail.guokuTransfer),'detail is category array after real settlement');ok(!('money' in n.sourcesDetail),'detail never becomes resource keyed map');
 near(n.ledgers.money.sources.guokuTransfer,100,'actual source same category per period');near(n.ledgers.money.sinks['宫廷'],100,'actual expense same category per period');
 c._getDaysPerTurn=()=>30;statement=c.FiscalEngine.readAccountStatement({game:c.GM,account:n,scope:'internal'});near(statement.account.turnDays,10,'posted period not reinterpreted after changing turn duration');
 for(const k of ['money','grain','cloth']){Object.assign(n.ledgers[k],{stock:0,thisTurnIn:0,thisTurnOut:0,lastTurnIn:987654,lastTurnOut:876543,sources:{old:987654},sinks:{old:876543}});}
 n.monthlyIncome=999999;n.monthlyExpense=888888;n.money=777777;n.balance=777777;
 const before=JSON.stringify(c.GM);c.renderNeitangPanel();statement=c.FiscalEngine.readAccountStatement({game:c.GM,account:n,scope:'internal'});
 ok(JSON.stringify(c.GM)===before,'zero actual render pure');near(statement.account.turnIncome,0,'settled zero not prior inflow');near(statement.account.turnExpense,0,'settled zero not prior outflow');near(statement.account.money,0,'ledger zero not stale money');ok(!elements['neitang-subtitle'].textContent.startsWith('预计'),'settled zero stays actual');ok(!elements['neitang-body'].innerHTML.includes('987654'),'prior nonzero source not resurrected');
}
ok(captions.every(x=>JSON.stringify(x)===JSON.stringify(captions[0])),'all three official model paths share section contract');
{
 const {c,elements}=fixture();c.CascadeTax.collect({turnDays:10});c.FixedExpense.collect({turnDays:10});c.NeitangEngine.monthlySettle(1/3);c.GM.turn=2;
 c.renderNeitangPanel();ok(elements['neitang-subtitle'].textContent.startsWith('上期交割'),'prior fiscal period is explicitly labeled');ok(!elements['neitang-subtitle'].textContent.includes('本期'),'prior cash is not current period cash');
 const unknown={unit:{money:'贯',grain:'石',cloth:'匹'},ledgers:{money:{stock:null},grain:{stock:null},cloth:{stock:null}},sources:{},expenses:{},turnDays:10};
 c._neitangRenderPanelBody(elements['neitang-body'],elements['neitang-subtitle'],unknown,{account:unknown,unit:unknown.unit,forecast:false},null);
 ok((elements['neitang-body'].innerHTML.match(/tr-led-stock">未具数/g)||[]).length===3,'all three unknown stocks are shown as unknown, not zero');
}
{
 const {c,scenario}=fixture();delete scenario.neitang.flowModel;c.NeitangEngine.initFromDynasty('唐','late',scenario);
 ok(c.NeitangEngine.isExplicit(),'fiscal accounting schema remains authoritative without scenario flowModel');
 c.GM.neitang.neicangRules={incidentalSources:[{id:'regional_tribute',mode:'fixed_annual',amount:12000}],autoTransfers:[{from:'guoku.money',to:'neicang.money',mode:'fixed',amount:100,cadence:'monthly'}],royalClanPressure:{enabled:true,basePopulation:80000,stipendPerCapita:50}};
 const money=c.GM.neitang.money,central=c.GM.guoku.money;c.NeitangEngine.tick({_monthRatio:1/3});
 near(c.GM.neitang.money,money,'declared tick does not execute legacy tribute or automatic inner allowance');near(c.GM.guoku.money,central,'declared tick does not debit central money through legacy autoTransfers');ok(!c.GM.neitang._royalClan,'declared tick never creates legacy dynastic clan expense');
}
{
 const {c}=fixture();c.GM.stateTreasury=0;c.GM.privateTreasury=0;load(c,'tm-party-class-llm-calibrator.js');
 const api=c.TM.PartyClassLlmCalibrator||c.TM.PartyClassLLMCalibrator||c.TM.PartyClassLlm;
 ok(api&&typeof api.buildSnapshot==='function','actual calibration snapshot API');
 const before=JSON.stringify(c.GM),snap=api.buildSnapshot(c.GM,{}),expected=c.FiscalEngine.readFiscalContext({game:c.GM});
 ok(JSON.stringify(snap.fiscalNote)===JSON.stringify(expected),'party AI uses common account fields');near(snap.fiscalNote.neitang.money,1000,'AI does not read default privateTreasury zero');ok(snap.fiscalNote.neitang.unit.money==='贯','AI preserves declared unit');ok(JSON.stringify(c.GM)===before,'AI snapshot read-only');
 const prompt=fs.readFileSync(path.join(ROOT,'tm-endturn-prompt.js'),'utf8'),a=prompt.indexOf('    // 财政上下文与库藏面板'),b=prompt.indexOf("    if (typeof MarchSystem",a);ok(a>=0&&b>a,'formal fiscal prompt block exists');c._mechResults=[];vm.runInContext(prompt.slice(a,b),c);ok(c._mechResults[0].includes(JSON.stringify(expected)),'formal prompt consumes shared context');
 const sc1b=fs.readFileSync(path.join(ROOT,'tm-endturn-ai.js'),'utf8'),x=sc1b.indexOf('            if ((_v.guoku || _v.neitang)'),y=sc1b.indexOf('            // 本回合税收级联摘要',x);ok(x>=0&&y>x,'SC1b fiscal block exists');c._v={guoku:{},neitang:{}};c.tp1='';vm.runInContext(sc1b.slice(x,y),c);ok(c.tp1.includes(JSON.stringify(expected))&&!c.tp1.includes('万两'),'SC1b same fields without silver-unit assumption');
}
console.log('[smoke-neitang-shared-fields] PASS '+checks+' assertions');
