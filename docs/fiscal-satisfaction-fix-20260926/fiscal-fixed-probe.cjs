'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../..'),web=path.join(root,'web'),file=path.join(web,'scripts/smoke-start-game-data-integrity.js');
const source=fs.readFileSync(file,'utf8').replace(/^#![^\n]*\n/,'');
const h=new Function('require','process','__dirname','__filename','module','exports',source.slice(0,source.indexOf('(async function main()'))+'\nreturn {loadGame,countState,dispose:()=>disposeGame()};')(createRequire(file),process,path.dirname(file),file,{exports:{}},{});
const c=h.loadGame(null),sc=JSON.parse(fs.readFileSync(path.join(root,'scenarios/天启七年·九月（官方）.json'),'utf8'));
c.__source=sc;
vm.runInContext("P.scenarios=P.scenarios.filter(s=>s.id!==__source.id);P.scenarios.push(__source);P.ai.key='';P.ai.url='';P.ai.model='';",c);
vm.runInContext('doActualStart(__source.id)',c,{timeout:60000});
const rail=fs.readFileSync(path.join(web,'phase8-formal-rightrail.js'),'utf8');
function installRail(){
 const names=['rightFinanceRoot','rightFinanceFirst','rightFinanceMoney','rightFinanceCollect','rightFinanceTagNames','rightFinanceResolveTagName','rightFinanceCascadeItems','rightFinanceItemList','rightFiscalReported','renderFinanceRich'];
 const functions=names.map(n=>{const match=rail.match(new RegExp('  function '+n+'\\([^]*?\\n  \\}'));assert(match,n);return match[0];}).join('\n');
 vm.runInContext("var esc=x=>String(x??'');var attr=esc;var compactText=x=>String(x);var rightArmyFmtNum=x=>String(x);var rightAdminNum=(v,f)=>Number.isFinite(Number(v))?Number(v):f;var rightArmyRows=rows=>rows.map(r=>'<div>'+r[0]+':'+r[1]+'</div>').join('');var getTurnText=t=>'T'+t;"+functions,c);
}
const auditInputs=['scenarios/天启七年·九月（官方）.json','web/phase8-formal-rightrail.js','web/tm-minxin-hard-links.js','web/tm-minxin-hard-link-consumers.js','web/tm-guoku-engine.js','web/tm-fiscal-engine.js','web/tm-fiscal-statements.js'];
const hashes=()=>Object.fromEntries(auditInputs.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const result={schema:'fiscal-fix-verification/1',scope:'Offline canonical Tianqi startup and direct production fiscal consumers. No model calls, no player save. Fiscal consumer sequence isolates the fault; it does not run a complete AI game turn.',inputSha256:hashes(),assertions:0,stages:[]};
function snapshot(label){
 const g=c.GM.guoku,l=g.ledgers.money,html=vm.runInContext('renderFinanceRich()',c);
 const display=c._guokuReadDisplayModel(c.GM,g);
 const x={label,turn:c.GM.turn,stock:g.money,ledgerStock:l.stock,scalar:{turnIncome:g.turnIncome,monthlyIncome:g.monthlyIncome,annualIncome:g.annualIncome,turnExpense:g.turnExpense,monthlyExpense:g.monthlyExpense},ledger:{thisTurnIn:l.thisTurnIn,thisTurnOut:l.thisTurnOut,sumSources:Object.values(l.sources||{}).reduce((a,b)=>a+Number(b),0)},display:{income:display.account.turnIncome,expense:display.account.turnExpense,forecast:display.forecast},rail:{income:html.match(/(?:本期|上期|预计)收入:([^<]+)/)?.[1],expense:html.match(/(?:本期|上期|预计)支出:([^<]+)/)?.[1],net:html.match(/<b>([^<]+)<\/b><span>(?:本期|上期|预计)结余/)?.[1]},lastCascade:c.GM._lastCascadeSummary?.central,lastCascadeTurn:c.GM._lastCascadeTurn};
 result.stages.push(x);console.log('[FISCAL]',JSON.stringify(x));return x;
}
setTimeout(()=>{try{
 assert(c.GM.sid===sc.id&&c.GM.turn===1,'canonical startup failed');installRail();
 result.opening={version:sc._version,days:c._getDaysPerTurn(),fiscalAccounting:sc.fiscalConfig?.accounting,guoku:sc.guoku};snapshot('opening');
 for(let i=0;i<3;i++){
  c.GM.turn=i+1;const days=c._getDaysPerTurn(),mr=days/30;
  c.CascadeTax.collect({turnDays:days});snapshot('cascade-'+(i+1));
  c.FixedExpense.collect({turnDays:days});snapshot('fixed-'+(i+1));
  c.GM.turn++;c.GuokuEngine.monthlySettle(mr);snapshot('settled-'+(i+1));
  c.TM.MinxinHardLinks.tick(c.GM,{turn:c.GM.turn,source:'offline-audit'});const before=snapshot('hard-links-'+(i+1));
  c.TM.MinxinHardLinkConsumers.consume(c.GM,{turn:c.GM.turn,source:'offline-audit'});const after=snapshot('hard-link-consumers-'+(i+1));
  assert.strictEqual(after.stock,before.stock,'consumer must not have deposited displayed revenue');result.assertions++;
  assert.strictEqual(after.ledger.thisTurnIn,before.ledger.thisTurnIn,'authoritative income unchanged');result.assertions++;
  assert.strictEqual(after.scalar.turnIncome,after.ledger.thisTurnIn,'consumer keeps canonical ledger income');result.assertions++;
  assert.strictEqual(after.display.income,after.ledger.thisTurnIn,'detail displays actual ledger income');result.assertions++;
  assert.strictEqual(after.rail.income,vm.runInContext('rightFinanceMoney(GM.guoku.ledgers.money.thisTurnIn)',c),'right rail displays actual ledger income');result.assertions++;
 }
 assert.deepStrictEqual(hashes(),result.inputSha256,'production inputs changed during fiscal probe');result.assertions++;
 fs.writeFileSync(path.join(__dirname,'fiscal-fixed-results.json'),JSON.stringify(result,null,2));h.dispose();process.exit(0);
}catch(e){console.error(e.stack);h.dispose();process.exit(1);}},250);
