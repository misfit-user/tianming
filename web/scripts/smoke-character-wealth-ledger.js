#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const WEB=path.resolve(__dirname,'..');let checks=0;
const acorn=require('acorn');
function sourceNode(file,predicate){const src=fs.readFileSync(path.join(WEB,file),'utf8'),ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'}),stack=[ast];while(stack.length){const x=stack.pop();if(!x||typeof x!=='object')continue;if(predicate(x))return src.slice(x.start,x.end);for(const v of Object.values(x)){if(Array.isArray(v))stack.push(...v);else if(v&&typeof v==='object')stack.push(v);}}throw Error('source node not found: '+file);}
function eq(a,b,m){checks++;assert.strictEqual(a,b,m)}function near(a,b,m){checks++;assert.ok(Math.abs(a-b)<1e-7,m+': '+a+' vs '+b)}function ok(v,m){checks++;assert.ok(v,m)}
function fixture(explicit=true){
 const math=Object.create(Math);math.random=()=>{throw Error('financial random generation not permitted in explicit fixture')};
 const s={Math:math,JSON,Date,Object,Array,String,Number,Boolean,RegExp,Error,isFinite,isNaN,parseInt,parseFloat,setTimeout(){},setInterval(){},clearTimeout(){},clearInterval(){},addEB(){},console:{log(){},warn(){},error(e){throw e}}};s.window=s;s.global=s;s.globalThis=s;s.TM={};
 s.P={id:'wealth',dynasty:'唐',time:{startMonth:1,startDay:14,daysPerTurn:10},characterEconomyConfig:explicit?{accounting:{schema:'tm-character-economy/2'}}:{}};
 s.GM={sid:'wealth',turn:1,currentDay:0,playerInfo:{factionId:'tang'},publicTreasuryConfig:{schema:'tm-public-treasury/2',accounts:[{id:'guoku',name:'国库',kind:'physical',factionId:'tang',source:{kind:'guoku'}},{id:'neitang',name:'内府',kind:'physical',factionId:'tang',source:{kind:'neitang'}}]},chars:[],facs:[{id:'tang',name:'唐',leader:'君主',treasury:{money:100000,grain:900,cloth:800}}],guoku:{money:100000,grain:900,cloth:800,balance:100000},neitang:{money:65000,grain:600,cloth:500,balance:65000},_salaryPaymentReceipts:[],corruption:{trueIndex:50,subDepts:{},supervision:{level:38}},settings:{}};
 s.findScenarioById=()=>s.P;s.CurrencyUnit={getUnit:()=>({money:'贯',grain:'石',cloth:'匹'})};
 const account={id:'treasury-tang',name:'朝廷国库',kind:'central',physicalAccountIds:['tang:central'],resources:{money:{stock:100000,available:50000,quota:50000,used:0,deficit:0},grain:{stock:900,available:800,quota:100,used:0,deficit:0},cloth:{stock:800,available:700,quota:100,used:0,deficit:0}},bindings:[{positionId:'prime',title:'宰相',role:'oversight'}],isReadOnly:true};
 s.FiscalEngine={getCharacterPublicAccounts(){return{known:true,accounts:[account],resources:account.resources}},getCharacterPayroll({characterId}){return{known:true,due:{money:30,grain:6,cloth:1},paid:{money:10,grain:2,cloth:1/3},receipts:s.GM._salaryPaymentReceipts.filter(r=>r.characterId===characterId)}},addToGuoku(amount){for(const k of ['money','grain','cloth'])s.GM.guoku[k]+=(amount[k]||0);s.GM.guoku.balance=s.GM.guoku.money;return{ok:true}}};
 vm.createContext(s);for(const name of ['tm-char-economy-engine.js','tm-char-economy-ledger.js','tm-char-economy-ui.js','tm-public-treasury.js'])vm.runInContext(fs.readFileSync(path.join(WEB,name),'utf8'),s,{filename:name});
 s.FiscalEngine.receivePrivateRecovery=o=>s.TM.PublicTreasury.receivePrivateRecovery(o);
 s.FiscalEngine.trySpendFromAccount=o=>s.TM.PublicTreasury.spend(o);s.FiscalEngine.getFactionAccountRef=o=>s.TM.PublicTreasury.getFactionAccountRef(o);
 function char(id,name='人物'){const c={id,name,age:40,health:80,stress:20,integrity:70,influence:30,loyalty:50,ambition:30,alive:true,socialClass:'commoner',resources:{privateWealth:{money:30,grain:5,cloth:1,land:0,treasure:0,commerce:0,slaves:0,debt:0},fame:20,virtueMerit:30,virtueStage:1},economyConfig:{incomeStreams:[],expenseStreams:[]}};s.GM.chars.push(c);return c;}
 return{s,L:s.TM.CharacterEconomyLedger,E:s.CharEconEngine,char};
}

{
 const {s,L,E,char}=fixture();const c=char('rich');Object.assign(c.resources.privateWealth,{money:5,grain:4,cloth:1,land:100,landHoldings:[{id:'own',area:100,estimatedValue:1000,yieldPerYear:{grain:2000},tenure:'owned'},{id:'family',area:10000,estimatedValue:50000,tenure:'family'},{id:'lease',area:40,estimatedValue:200,tenure:'leased'}],debts:[{id:'d',amount:{money:2,grain:1}}]});
 let before=JSON.stringify(c);const summary=E.calcPrivateSummary(c);eq(summary.money,5,'land valuation never becomes liquid money');eq(summary.grain,4,'annual harvest never becomes stored grain');eq(summary.landArea,100,'family and leased land excluded from privately owned area');eq(summary.assetEstimateMoney,1000,'only explicit owned appraisal counted');eq(summary.totalValue.money,1003,'estimated net worth remains separate');eq(JSON.stringify(c),before,'summary is a pure read');
 c.role='皇帝';c.officialTitle='皇帝';c.isPlayer=true;c.name='君主';E.ensureCharResources(c);E.updatePublicTreasuryMirror(c);eq(c.resources.privateWealth.money,5,'emperor retains private cash');eq(c.resources.privateWealth.grain,4,'emperor retains private grain');eq(c.resources.privateWealth.isNeitang,undefined,'personal wealth is not palace treasury');eq(c.resources.publicTreasury.balance,100000,'entrusted treasury is still visible');eq(s.GM.facs[0].leaderPrivate,undefined,'never manufactures five percent sovereign private treasury');
 before=JSON.stringify(s.GM);const snap=E.buildEconomySnapshot(c);eq(snap.privateSummary.money,5,'economy snapshot uses liquidity');eq(JSON.stringify(s.GM),before,'declared economy snapshot does not write');
 ok(s.renderCharResourcesSection,'character UI export present');const html=s.renderCharResourcesSection(c);ok(html.includes('私用钱粮'),'explicit private section rendered');ok(html.includes('经手府库'),'entrusted accounts rendered separately');ok(html.includes('宰相 · 监临核议'),'public-account oversight role is explicit');ok(html.includes('支给另由收掌官承办'),'oversight is not presented as direct custody');ok(!/GM\.|publicTreasury|intensity|只读镜像/.test(html),'technical placeholders absent');eq(JSON.stringify(s.GM),before,'rendering never mutates character or treasury');
 const pt=E.getCharPublicTreasuryDisplay(c);eq(pt.money,100000,'pure public display returns entrusted aggregate');eq(JSON.stringify(s.GM),before,'public display does not mutate');
 c.resources.privateWealth.money=0;E.ensureCharResources(c);eq(c.resources.privateWealth.money,0,'explicit empty wallet stays empty');
 const result=E.pursueTreasuryDeficit(c,{publicTreasury:{money:{deficit:900}}});eq(result.pursued,0,'budget deficit is not proven personal liability');eq(c.resources.privateWealth.money,0,'unadjudicated shortage takes no private cash');
}

{
 const {s,L,E,char}=fixture(),c=char('paid');const beforePublic=s.GM.guoku.money;const receipt={id:'wealth:1:office:paid',turn:1,payerId:'tang',fundId:'tang:central',positionId:'office',characterId:c.id,paid:true,amount:{money:10,grain:2,cloth:.5}};
 eq(E.receiveSalaryPayment(c,receipt).reason,'unfunded-payment','receipt must exist at public payment owner');
 for(const k of ['money','grain','cloth'])s.GM.guoku[k]-=receipt.amount[k];s.GM._salaryPaymentReceipts.push(receipt);
 const result=E.receiveSalaryPayment(c,receipt);ok(result.ok,'funded receipt accepted');eq(c.resources.privateWealth.money,40,'money credited once');eq(c.resources.privateWealth.grain,7,'salary grain reaches grain stock');near(c.resources.privateWealth.cloth,1.5,'salary cloth reaches cloth stock');eq(s.GM.guoku.money,beforePublic-10,'recipient never debits public account again');
 ok(E.receiveSalaryPayment(c,receipt).duplicate,'duplicate receipt rejected');E.settleSalaryReceipts(c);eq(c.resources.privateWealth.money,40,'receipt settlement remains idempotent');
 eq(E.paySalary(c,999).ok,false,'old anonymous salary credit blocked');eq(E.addBribeIncome(c,999,.5).ok,false,'anonymous illicit credit blocked');eq(c.resources.privateWealth.money,40,'blocked credits create no money');
 c.economyConfig.incomeStreams=[{id:'copy',kind:'service',label:'抄写酬谢',annual:{money:36,grain:3.6}}];c.economyConfig.expenseStreams=[{id:'living',monthly:{money:3,grain:.6}}];
 const outcome=L.tickCharacter(c,1/3);ok(outcome.ok,'explicit economy settles');near(c.resources.privateWealth.money,40,'one turn net cash is zero');near(c.resources.privateWealth.grain,6.9,'resource spending remains separate');near(c.economyLedger.lastSettlement.income.money,11,'actual salary included in period income');near(c.economyLedger.lastSettlement.income.grain,2.1,'salary and production grain kept in same resource');
 ok(L.tickCharacter(c,1/3).duplicate,'same period cannot settle twice');near(c.resources.privateWealth.money,40,'retry creates no production or expenses');
}

{
 const {s,L,E,char}=fixture(),c=char('farm');c.resources.privateWealth.landHoldings=[{id:'lease',area:20,tenure:'leased',ownershipShare:0}];c.economyConfig.incomeStreams=[{id:'crop',kind:'farm',assetId:'lease',annual:{grain:12},months:[6,10]}];
 L.tickCharacter(c,1/3);eq(c.resources.privateWealth.grain,5,'no harvest before configured collection month');s.GM.turn++;s.GM.currentDay=150;L.tickCharacter(c,1/3);eq(c.resources.privateWealth.grain,7,'leased cultivation yields grain while land stays outside equity');eq(L.summarize(c).landArea,0,'leased farming does not turn into owned land');
 s.GM.turn++;c.resources.privateWealth.landHoldings=[];L.tickCharacter(c,1/3);eq(c.resources.privateWealth.grain,7,'lost land right stops its income');
 c.resources.privateWealth.money=0;c.economyConfig.expenseStreams=[{id:'unpaid',monthly:{money:3}}];s.GM.turn++;L.tickCharacter(c,1/3);eq(c.resources.privateWealth.money,0,'lack of money never creates negative stock');eq(c.economyLedger.arrears.money,1,'unpaid obligation is recorded separately');
 c.retired=true;s.GM.turn++;L.tickCharacter(c,1/3);eq(c.economyLedger.arrears.money,2,'retirement does not freeze household expenses');
 c.resources.hiddenWealth=0;c.integrity=0;eq(E.estimateHiddenWealth(c),0,'low integrity does not fabricate secret assets');
}

{
 const {s,L,E,char}=fixture(),parent=char('parent'),a=char('a'),b=char('b');parent.family={children:[a.id,b.id]};Object.assign(parent.resources.privateWealth,{money:60,grain:10,cloth:4,land:20,landHoldings:[{id:'field',area:20,tenure:'owned',estimatedValue:100}],debt:10,debts:[{id:'loan',amount:{money:10}}]});
 const r=E.distributeInheritance(parent);ok(r.ok,'estate transferred to known heirs');eq(parent.resources.privateWealth.money,0,'deceased cash removed');eq(a.resources.privateWealth.money,60,'half cash received without appraisal conversion');eq(b.resources.privateWealth.money,60,'other heir receives same share');near(L.summarize(a).landArea,10,'owned title share transferred');eq(a.resources.privateWealth.debts[0].amount.money,5,'debt share transferred');ok(E.distributeInheritance(parent).duplicate,'estate not distributed twice');
 const alone=char('alone'),before=s.GM.neitang.money;eq(E.distributeInheritance(alone).reason,'awaiting-heirs','unknown heirs require estate handling');eq(s.GM.neitang.money,before,'no automatic half estate created in palace treasury');eq(alone.resources.privateWealth.money,30,'unclaimed estate retained');
}

{
 const {s,L,E,char}=fixture(),c=char('seize');Object.assign(c.resources.privateWealth,{money:20,grain:3,cloth:2,land:100,landHoldings:[{id:'field',area:100,estimatedValue:900,tenure:'owned'},{id:'temple',area:1000,estimatedValue:5000,tenure:'temple'}],treasure:100});c.resources.hiddenWealth=10;
 const before=s.GM.guoku.money;
 const fail=E.confiscate(c,{intensity:.5,_faultInjector(){throw Error('receipt test fault')}});eq(fail.success,false,'native owner aborts failed recovery');eq(c.resources.privateWealth.money,20,'native recovery rolls private cash back');eq(c.resources.hiddenWealth,10,'native recovery rolls hidden cash back');eq(s.GM.guoku.money,before,'failed recovery leaves public money unchanged');
 const r=E.confiscate(c,{intensity:.5});ok(r.success,'existing personal assets can be seized');eq(s.GM.guoku.money-before,25,'only present cash plus discovered hidden cash enters treasury');eq(c.resources.privateWealth.money,0,'source cash removed');eq(c.resources.hiddenWealth,5,'undiscovered money remains');eq(c.economyLedger.estateSeizure.landArea,100,'land title recorded separately');eq(c.resources.privateWealth.landHoldings.length,1,'temple property is not confiscated as personal estate');eq(E.confiscate(c,{}).success,false,'repeated confiscation rejected');
}

{
 const {s,L,E,char}=fixture(),c=char('refs'),heir=char('ref-heir');
 s.P.characterEconomyConfig.assets=[{id:'owned-ref',name:'平泉山居',area:30,estimatedValue:900,tenure:'owned',ownershipShare:1},{id:'temple-ref',name:'寺中共田',area:100,estimatedValue:3000,tenure:'temple',ownershipShare:0},{id:'family-trade',name:'家中货股',estimatedValue:50,tenure:'owned',ownershipShare:1}];
 c.resources.privateWealth.landHoldings=[{assetId:'owned-ref'},{assetId:'temple-ref'}];c.resources.privateWealth.familyBusiness=[{assetId:'family-trade'}];c.economyConfig.incomeStreams=[{id:'rent',kind:'rent',assetId:'owned-ref',annual:{grain:36}}];
 eq(L.summarize(c).landArea,30,'bare references resolve ownership before aggregation');L.tickCharacter(c,1/3);eq(c.resources.privateWealth.grain,6,'bare reference permits its actual rent income');ok(s.renderCharResourcesSection(c).includes('家中货股'),'familyBusiness is visible');
 c.family={children:[heir.id]};E.distributeInheritance(c);eq(L.summarize(heir).landArea,30,'inheritance resolves rights before transfer');eq(heir.resources.privateWealth.landHoldings.length,1,'temple asset cannot be inherited through a bare ref');
 const c2=char('ref-seize');c2.resources.privateWealth.landHoldings=[{assetId:'owned-ref'},{assetId:'temple-ref'}];E.confiscate(c2,{});eq(c2.resources.privateWealth.landHoldings.length,1,'seizure preserves referenced temple assets');eq(c2.economyLedger.estateSeizure.landArea,30,'seizure records resolved private land only');
 s.FiscalEngine.getCharacterPayroll=()=>{throw Error('unexpected budget simulation')};const c3=char('fast');L.tickCharacter(c3,1/3);ok(c3.economyLedger.lastSettlement,'character settlement never previews all faction budgets');
}

{
 const {s,L,E,char}=fixture(),c=char('foreign-winner');c.faction='foreign';c.graduateTitle='武状元';c._wujuYear=840;
 s.GM.facs.push({id:'foreign',name:'外国',treasury:{money:70,grain:0,cloth:0}});s.GM.publicTreasuryConfig.accounts.push({id:'foreign-public',name:'外国王庭公库',kind:'physical',factionId:'foreign',source:{kind:'faction',id:'foreign'}});
 const src=sourceNode('tm-keju-wuju.js',x=>x.type==='FunctionDeclaration'&&x.id.name==='_kjG3ApplyWuxiangshiRewards');vm.runInContext(src,s);
 const before=s.GM.guoku.money,r=s._kjG3ApplyWuxiangshiRewards(c);ok(r.ok,'actual examination reward handler uses funded payment');eq(c.resources.privateWealth.money,100,'short-funded award credits only actual 70');eq(r.shortfall.money,430,'unpaid award retained in receipt');eq(s.GM.facs[1].treasury.money,0,'foreign treasury bears its own award');eq(s.GM.guoku.money,before,'foreign award never borrows player central cash');
 const fame=c.resources.fame;s._kjG3ApplyWuxiangshiRewards(c);eq(c.resources.privateWealth.money,100,'award replay does not credit twice');eq(c.resources.fame,fame,'award replay does not duplicate recognition');
 s.GM.turn++;s._kjG3ApplyWuxiangshiRewards(c);eq(c.resources.privateWealth.money,100,'same examination award stays idempotent on later turn');
 const noFund=char('unfunded-winner');noFund.faction='unregistered';noFund.graduateTitle='武探花';const denied=s._kjG3ApplyWuxiangshiRewards(noFund);eq(denied.ok,false,'missing own-faction account does not trigger fallback');eq(noFund.resources.privateWealth.money,30,'unfunded exam result generates no cash');
}

{
 const {s,L,E,char}=fixture(),c=char('governor','本州主官');const div={id:'county',name:'本州',governor:c.name,governorId:c.id,publicTreasury:{money:{stock:20,available:20},grain:{stock:0,available:0},cloth:{stock:0,available:0}}};s.GM.adminHierarchy={player:{divisions:[div]}};s.GM.publicTreasuryConfig.accounts.push({id:'county-fund',name:'本州库',kind:'physical',factionId:'tang',source:{kind:'region',id:div.id}});s.GM._turnReport=[];
 s.G=s.GM;s.applied={failed:[]};s.aiOutput={localActions:[{region:div.id,type:'illicit',amount:100,reason:'追查经手侵夺'}]};s._findDivisionByNameOrId=(G,id)=>id===div.id?div:null;
 const expr=sourceNode('modules/ai-change-applier/core.js',x=>x.type==='CallExpression'&&x.callee&&x.callee.type==='MemberExpression'&&x.callee.property.name==='forEach'&&x.callee.object.type==='LogicalExpression'&&x.callee.object.left.type==='MemberExpression'&&x.callee.object.left.object.name==='aiOutput'&&x.callee.object.left.property.name==='localActions');
 const before=s.GM.guoku.money;vm.runInContext(expr,s);eq(div.publicTreasury.money.stock,0,'actual local-action handler debits its real region');eq(c.resources.privateWealth.money,42,'personal recipient gets 60 percent of actual 20');eq(s.GM.guoku.money,before,'local diversion cannot fallback to central treasury');eq(div.fiscal.expenditures.illicit[0].untracedAmount,8,'remaining 40 percent has an explicit untraced disposition');
 vm.runInContext(expr,s);eq(c.resources.privateWealth.money,42,'local-action replay never credits twice');eq(div.fiscal.expenditures.illicit.length,1,'local-action receipt is not duplicated');
 s.aiOutput.localActions[0].transactionId='another-empty-withdrawal';vm.runInContext(expr,s);eq(c.resources.privateWealth.money,42,'empty regional account cannot credit private cash');eq(div.fiscal.expenditures.illicit.length,1,'unfunded local action does not create a paid expenditure');eq(s.applied.failed.length,1,'unfunded local action reports its missing funds');
 s.GM.publicTreasuryConfig.accounts=s.GM.publicTreasuryConfig.accounts.filter(a=>a.id!=='county-fund');s.aiOutput.localActions[0].transactionId='missing-region-account';vm.runInContext(expr,s);eq(s.GM.guoku.money,before,'missing regional account cannot borrow from central cash');eq(c.resources.privateWealth.money,42,'missing regional account leaves personal cash untouched');
}

console.log('PASS character wealth ledger: '+checks+' assertions; offline only, no AI or game turn execution.');
