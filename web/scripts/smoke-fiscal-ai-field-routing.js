'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),web=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(__dirname,'smoke-ai-writeback-integrity.js'),'utf8').replace(/^#![^\n]*\n/,''),cut=source.indexOf('async function main()');assert(cut>0);
const helpers=new Function('require','__dirname',source.slice(0,cut)+'\nreturn {makeContext,baseGM};')(require,__dirname);
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
(async()=>{
 const c=helpers.makeContext();for(const f of ['tm-fiscal-statements.js','tm-fiscal-engine.js','tm-endturn-apply.js'])vm.runInContext(fs.readFileSync(path.join(web,f),'utf8'),c,{filename:f});
 const diagnostics=[];c._dbg=()=>{};c.applyCharacterDeaths=()=>{};c.GM=helpers.baseGM({vars:{stateTreasury:{value:999,min:0,max:10000},'民心_江南':{value:55,min:0,max:100}},stateTreasury:888,privateTreasury:777,_edictTracker:[{id:'real-edict',content:'支给守军十贯。'}],_edictLifecycle:[{edictId:'real-edict',stages:[],totalEffects:{}}]});
 const apply=c.TM.Endturn.AI.apply;apply.recordUnappliedChange=r=>diagnostics.push(r);
 c.FiscalEngine.addToGuoku({money:0},'fixture-init',c.GM);c.FiscalEngine.addToNeitang({money:0},'fixture-init',c.GM);
 // Platform assembly is outside this test; fiscal_adjustments still uses the real production applier.
 apply.stages={_applyCore_reconcile:async ctx=>{const r=c.applyAITurnChanges(ctx.results.sc1);ok(r.ok,'production fiscal adjustment commits');},_applyPostValidateAssemble:ctx=>ctx};
 const p1={edict_lifecycle_update:[{edictId:'real-edict',stage:'execution',currentEffects:{stateTreasury:-500,privateTreasury:80,'guoku.money':-300,'民心_江南':-5}}],fiscal_adjustments:[{action:'add',target:'guoku',kind:'expense',resource:'money',name:'守军临时支给',amount:10,recurring:false,reason:'执行真实诏令'}]};
 await apply.writeBack({results:{sc1:p1},prompt:{sc:{}},record:{},meta:{}});
 ok(c.GM.guoku.money===990&&c.GM.guoku.ledgers.money.stock===990,'canonical fiscal field actually debits ten, not shadow five hundred');
 ok(c.GM.guoku.ledgers.money.thisTurnOut===10,'canonical ledger records actual single payment '+JSON.stringify({ledger:c.GM.guoku.ledgers.money,expenses:c.GM.guoku.extraExpense}));
 ok(c.GM.stateTreasury===888&&c.GM.privateTreasury===777,'obsolete scalar fields never receive side writes');
 ok(c.GM.vars.stateTreasury.value===999,'obsolete financial key cannot enter generic variable fallback');
 ok(c.GM.vars['民心_江南'].value===50,'nonfinancial currentEffects still apply');
 ok(diagnostics.length===3&&diagnostics.every(r=>r.kind==='fiscal'),'unsupported financial aliases reported through existing unapplied-change diagnostic');
 ok(!Object.keys(c.GM._edictLifecycle[0].totalEffects).some(k=>/Treasury|guoku/.test(k)),'shadow effects never look like a committed receipt');
 const text=fs.readFileSync(path.join(web,'tm-endturn-ai.js'),'utf8');ok(!text.includes('\\"currentEffects\\":{\\"stateTreasury\\"'),'AI example no longer requests incompatible treasury field');ok(text.includes('currentEffects仅写非财务变量')&&text.includes('fiscal_adjustments'),'AI contract names the existing fiscal writer');
 console.log('[smoke-fiscal-ai-field-routing] PASS '+checks+' assertions');
})().catch(e=>{console.error(e.stack);process.exit(1);});
