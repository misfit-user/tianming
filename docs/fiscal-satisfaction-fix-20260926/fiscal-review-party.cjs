'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'web/scripts/smoke-native-fiscal-consumers.js');
const text=fs.readFileSync(file,'utf8'),end=text.indexOf('(async () => {');
const h=new Function('require','__dirname',text.slice(0,end)+'\nreturn {ctx,setup,load};')(createRequire(file),path.dirname(file));
(async()=>{
 h.load('tm-fiscal-statements.js');
 const {g}=await h.setup(s=>{
  s.nativeStart.accounts.forEach(a=>{a.balance=0;a.flowModel={type:'fixed',periodDays:30,income:0,expense:10};});
  s.military.initialTroops.forEach(a=>Object.assign(a,{monthlyMoneyPayPerSoldier:0,monthlyGrainPayPerSoldier:0,monthlyClothPayPerSoldier:0}));
  s.officeTree.forEach(d=>(d.positions||[]).forEach(p=>p.salaryPayments=[]));
  Object.values(s.officeRegistryByFaction||{}).flat().forEach(d=>(d.positions||[]).forEach(p=>p.salaryPayments=[]));
 });
 const input=h.ctx.TM.NativeFiscal.settle(g,'income',{turnDays:30}),output=h.ctx.TM.NativeFiscal.settle(g,'expense',{turnDays:30});
 const st=h.ctx.FiscalStatement.read({game:g,account:g.guoku,scope:'central'});
 const result={nativeZero:{input,output,forecast:st.forecast,income:st.account.turnIncome,expense:st.account.turnExpense,ledger:st.account.ledgers.money,operations:g.nativeWorld.fiscalOperations}};
 const cases=[{turnIncome:17463000,turnExpense:2606000,ledgers:{grain:{stock:10,thisTurnIn:2,thisTurnOut:0}}},{flowBasis:'actual',turnIncome:17463000,turnExpense:2606000,ledgers:{money:{stock:10,thisTurnOut:5}}},{flowBasis:'forecast',turnIncome:400,turnExpense:200,ledgers:{money:{stock:10,thisTurnIn:400,thisTurnOut:200}}},{flowBasis:'actual',turnIncome:400,turnExpense:200,ledgers:{money:{stock:10,thisTurnIn:-5,thisTurnOut:-2}}}];
 result.legacy=cases.map(account=>{const s=h.ctx.FiscalStatement.read({game:{turn:4},account});return{input:account,forecast:s.forecast,income:s.account.turnIncome,expense:s.account.turnExpense,net:s.account.lastDelta,money:s.account.ledgers.money};});
 fs.writeFileSync(path.join(__dirname,'fiscal-review-party.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
