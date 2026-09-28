// 真开局 + 360日统一财政观察窗；legacy分母365，ledger/2分母360，不推进AI与战争。
// node --max-old-space-size=1536 tools/tax-base-probe.js tianqi|shaosong|tang <输出.json> [--baseline <git ref>]
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../../..');
const FIELDS=['saltProduction','mineralProduction','maritimeTradeVolume'];
const clone=x=>JSON.parse(JSON.stringify(x));
const leaves=nodes=>(nodes||[]).flatMap(d=>d.children&&d.children.length?leaves(d.children):[d]);
function read(file,ref){return ref?execFileSync('git',['show',ref+':'+file],{cwd:ROOT,maxBuffer:256*1024*1024}).toString('utf8'):fs.readFileSync(path.join(ROOT,file),'utf8');}
function installedFiscal(name){const s=JSON.parse(read('scenarios/'+name));return {fiscalConfig:s.fiscalConfig,factionConfigs:Object.fromEntries(s.factions.filter(f=>f.fiscalConfig).map(f=>[f.id||f.name,f.fiscalConfig]))};}
function helpers(ref){
  const dir=path.join(ROOT,'web/scripts'),file=path.join(dir,'smoke-start-game-data-integrity.js');
  const s=fs.readFileSync(file,'utf8').replace(/^#![^\n]*\n/,'');
  const runtime=new Set(['tm-game-loop.js','tm-patches-start.js','tm-guoku-engine.js','tm-fiscal-engine.js','tm-fiscal-statements.js','tm-public-treasury.js']);
  const localRequire=id=>id==='fs'&&ref?Object.assign({},fs,{readFileSync:(f,...args)=>runtime.has(path.basename(String(f)))?read('web/'+path.basename(String(f)),ref):fs.readFileSync(f,...args)}):require(id);
  return new Function('require','process','__dirname','__filename','module','exports',s.slice(0,s.indexOf('// 天启官方地图'))+'\nreturn {loadGame,disposeGame:function(){disposeGame();}};')(localRequire,process,dir,file,{exports:{}},{});
}
function summarize(rows){const out={};for(const r of rows){const t=out[r.id]||(out[r.id]={name:r.name,base:r.base,resource:r.resource,nominal:0,central:0,local:0,skimmed:0,transit:0});for(const k of ['nominal','central','local','skimmed','transit'])t[k]+=r[k]||0;}for(const t of Object.values(out))for(const k of ['nominal','central','local','skimmed','transit'])t[k]=Math.round(t[k]*1e4)/1e4;return out;}
async function probe(key,file,ref){
  const name=require('../data/'+key+'-tax-base').scenario,installed=ref?installedFiscal(name):null;
  const source=JSON.parse(read('scenarios/'+name,ref)),h=helpers(ref),c=h.loadGame(null);
  vm.runInContext('var __seed=840;Math.random=function(){__seed=(Math.imul(__seed,1664525)+1013904223)>>>0;return __seed/4294967296;};',c);
  const hook='var split = splitCascadeAmount(div, tax, amount, ctx);';let code=read('web/tm-fiscal-engine.js',ref);assert.equal(code.split(hook).length,2);
  code=code.replace(hook,hook+'\nif(global.__taxRows)global.__taxRows.push({id:tax.id,name:tax.name,base:tax.base,resource:storeAs,nominal:(typeof rawTaxAmount==="function"?rawTaxAmount(div,tax):taxBase(div,tax)*safeNumber(tax.baseFactor,1)*safeNumber(tax.rate,0))*(tax.annual?ctx.turnFracOfYear:1),central:split.toCentral,local:split.cunliu,skimmed:split.skimmed,transit:split.lostInTransit});');
  vm.runInContext(code,c);c.__source=source;
  vm.runInContext('P.scenarios=(P.scenarios||[]).filter(s=>s.id!==__source.id);P.scenarios.push(__source);P.ai.key="";P.ai.url="";P.ai.model="";',c);
  vm.runInContext('doActualStart('+JSON.stringify(source.id)+')',c,{timeout:600000});
  await new Promise(r=>setTimeout(r,1000));assert(c.__entered&&c.GM.sid===source.id,'真实开局未完成');
  if(!ref){assert.equal(c.GM.fiscalConfig.productionTaxVersion,1,'新税表标记丢失');for(const t of source.fiscalConfig.taxList.filter(t=>t.productionTax))assert.deepStrictEqual(clone(c.GM.fiscalConfig.taxList.find(r=>r.id===t.id).productionTax),t.productionTax,'开局丢失产量税声明 '+t.id);}
  const snapshotKeys=['adminHierarchy','guoku','neitang','facs','chars','turnChanges','_lastCascadeTaxTurn','_lastCascadeTurn','_lastCascadeSummary','turn'];
  const snapshot=Object.fromEntries(snapshotKeys.filter(k=>c.GM[k]!==undefined).map(k=>[k,JSON.stringify(c.GM[k])]));
  function reset(){for(const k of snapshotKeys){if(k in snapshot)c.GM[k]=JSON.parse(snapshot[k]);else delete c.GM[k];}}
  function amounts(){return Object.fromEntries(FIELDS.map(k=>[k,leaves(c.GM.adminHierarchy.player.divisions).reduce((n,d)=>n+(d.economyBase[k]||0),0)]));}
  function collect(days){c.__taxRows=[];const r=c.CascadeTax.collect({game:c.GM,force:true,turnDays:days});assert(r.ok,'征收失败');return {taxes:summarize(r.budget?r.budget.regions.flatMap(x=>x.taxes):c.__taxRows),central:clone(r.totals.central),local:clone(r.totals.localRetain)};}
  const report={scenario:source.id,sourceRef:ref||'working-tree',unit:source.fiscalConfig.unit,method:'doActualStart + actual CascadeTax.collect(force,360 days); legacy year=365, ledger/2=360; fiscal-only, fixed opening seed 840; no AI/network/war/spending',native:!!(c.TM.NativeFiscal&&c.TM.NativeFiscal.enabled(c.GM)),openingProduction:amounts()};
  let preview;
  if(!ref){preview=c.CascadeTax.previewRevenue({game:c.GM,turnDays:360});assert(preview,'缺同口径预估');}
  Object.assign(report,collect(360));
  if(preview){for(const k of ['money','grain','cloth']){assert(Math.abs(preview.totals.central[k]-report.central[k])<0.05,key+' preview central '+k);assert(Math.abs(preview.totals.localRetain[k]-report.local[k])<0.05,key+' preview local '+k);}report.previewMatches=true;}
  report.sensitivity=[];
  if(!ref)for(const driver of ['production','population-held-production','population-with-production'])for(const factor of [0.8,1.2]){
    reset();const all=leaves(c.GM.adminHierarchy.player.divisions);
    for(const d of all){if(driver==='production')for(const k of FIELDS)d.economyBase[k]*=factor;else d.populationDetail.mouths*=factor;}
    const p=driver==='population-held-production'?c.CascadeTax.previewRevenue({game:c.GM,turnDays:360,settleProduction:false}):null;
    const sample=p?{taxes:summarize(p.regions.flatMap(r=>r.taxes)),central:clone(p.totals.central),local:clone(p.totals.localRetain)}:collect(360);
    report.sensitivity.push({driver,factor,production:amounts(),...sample});
  }
  if(!ref){reset();report.turns=[];for(let i=0;i<6;i++){c.GM.turn++;const r=collect(10);report.turns.push({turn:c.GM.turn,days:10,production:amounts(),...r});}}
  if(ref){
    // Same old world, new installed scenario and engine: no new VM, no migration of production state.
    reset();c.GM._isFreshNewGame=false;
    // Fiscal configs were extracted before boot: do not retain a second 90MB map/world in this VM.
    c.__currentTaxSource=Object.assign({},source,{fiscalConfig:installed.fiscalConfig,factions:source.factions.map(f=>installed.factionConfigs[f.id||f.name]?Object.assign({},f,{fiscalConfig:installed.factionConfigs[f.id||f.name]}):f)});
    vm.runInContext('var __priorTaxFind=findScenarioById;findScenarioById=function(id){return id===__currentTaxSource.id?__currentTaxSource:__priorTaxFind(id);};',c);
    let currentCode=read('web/tm-fiscal-engine.js');
    currentCode=currentCode.replace(hook,hook+'\nif(global.__taxRows)global.__taxRows.push({id:tax.id,name:tax.name,base:tax.base,resource:storeAs,nominal:rawTaxAmount(div,tax)*(tax.annual?ctx.turnFracOfYear:1),central:split.toCentral,local:split.cunliu,skimmed:split.skimmed,transit:split.lostInTransit});');
    vm.runInContext(currentCode,c);vm.runInContext(read('web/tm-guoku-engine.js'),c);c.FiscalEngine.enableTaxesByDynasty(c.GM);
    const upgraded=collect(360);
    assert.deepStrictEqual(upgraded.taxes,report.taxes,'新引擎/新剧本改变旧档税目');
    assert.deepStrictEqual(upgraded.central,report.central,'旧档中央变化');assert.deepStrictEqual(upgraded.local,report.local,'旧档地方变化');
    report.legacyCompatibility={newScenarioDefaults:true,sameVM:true,allTaxRowsAndDestinationsIdentical:true,storedConfigKeys:Object.keys(c.GM.fiscalConfig)};
  }
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');h.disposeGame();
  console.log('PASS '+key+' '+Object.keys(report.taxes).length+' taxes; preview='+report.previewMatches+'; RSS MiB='+Math.round(process.memoryUsage().rss/1048576));
}
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--baseline');probe(a[0],a[1],i>=0?a[i+1]:null).then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1);});}
module.exports={probe,summarize};
