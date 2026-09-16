#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
function src(file){return fs.readFileSync(path.join(ROOT,file),'utf8');}
function grab(file,name){const text=src(file),tree=require('acorn').parse(text,{ecmaVersion:'latest'}),q=[tree];while(q.length){const n=q.pop();if(!n||typeof n!=='object')continue;if(n.type==='FunctionDeclaration'&&n.id?.name===name)return text.slice(n.start,n.end);for(const v of Object.values(n))if(Array.isArray(v))q.push(...v);else if(v&&typeof v==='object')q.push(v);}throw Error('Missing '+name);}
async function main(){
  const activate=grab('tm-three-systems-ext.js','_activateOpeningLetters');
  for(const name of ['李瀍','赵构','朱由检']){
    const tpl={id:'old-opening',from:'远臣',title:'边城来书',content:'城中尚寒。'};
    const context={P:{playerInfo:{characterName:name},time:{daysPerTurn:10}},GM:{turn:1,sid:'test',letters:[{...tpl,isOpening:true,_playerRead:true}]},findScenarioById:()=>({openingLetters:[tpl]}),console};
    context.global=context;context.window=context;vm.createContext(context);vm.runInContext(activate+';_activateOpeningLetters();',context);
    assert.equal(context.GM.letters.length,1);assert.equal(context.GM.letters[0].to,name);assert.equal(context.GM.letters[0].subjectLine,tpl.title);assert.equal(context.GM.letters[0].status,'delivered');assert.equal(context.GM.letters[0]._playerRead,true);
    context.GM._openingLettersActivated=false;vm.runInContext('_activateOpeningLetters();',context);assert.equal(context.GM.letters.length,1);
  }
  const init=grab('tm-keju-runtime.js','initKejuSystem');
  for(const key of ['', 'configured-provider']){
    const scenario={era:'唐',keju:{enabled:true,examIntervalNote:'岁贡',tiers:[{name:'举送',level:'province'},{name:'省试',level:'national'}]}};
    const ctx={P:{keju:{},ai:{key}},console,_kjGetPresetByEra:()=>({enabled:true,tiers:[{name:'错误默认殿试'}]}),_getDefaultTiers:()=>[],_kjFinalizeTiersAndDict:()=>{},callAISmart:()=>{throw Error('Explicit scenario must not be replaced by generated defaults')}};
    vm.createContext(ctx);vm.runInContext(init,ctx);await ctx.initKejuSystem(scenario);assert.deepEqual(JSON.parse(JSON.stringify(ctx.P.keju.tiers)),scenario.keju.tiers);assert.equal(ctx.P.keju.examIntervalNote,'岁贡');ctx.P.keju.tiers[0].name='后改';assert.equal(scenario.keju.tiers[0].name,'举送');
  }
  const collect=grab('phase8-formal-bridge.js','collectRecentEvents');
  {
    const overrides={ceremony:{palaceTest:false},allocationRules:{waitingYears:0},graduateTitle:'候铨',examInterval:1};
    const ctx={P:{keju:{enabled:true,tiers:[{name:'省试',level:'national'}],paradigmOverrides:overrides},time:{year:840}},GM:{year:840},console};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src('tm-keju-paradigm.js'),ctx);const p=ctx._kjpInitParadigm();assert.equal(p.ceremony.palaceTest,false);assert.equal(p.allocationRules.waitingYears,0);assert.equal(p.graduateTitle,'候铨');assert.equal(p.examInterval,1);p.ceremony.palaceTest=true;assert.equal(overrides.ceremony.palaceTest,false);
  }
  const state={eventLookback:3},window={GM:{turn:1,events:[{title:'未发生',type:'conditional',triggered:false},{title:'未来时点',turn:8,triggered:true},{title:'已发生',triggered:true}],evtLog:[{turn:1,type:'耳报',text:'西市钱价有异'}]}};
  const recent=new Function('window','state','compactText','getTurnText',collect+';return collectRecentEvents;')(window,state,(s,n)=>String(s).slice(0,n),()=> '开局');
  const list=recent();assert(!list.some(x=>/未发生|未来时点/.test(x.title)));assert(list.some(x=>x.title==='已发生'));assert(list.some(x=>x.title==='西市钱价有异'));
  const money=grab('phase8-formal-rightrail.js','rightArmyMoneyText');
  const fmt=new Function('rightArmyFirst','rightArmyFmtNum',money+';return rightArmyMoneyText;')((a,ks,f)=>{const k=ks.find(k=>a[k]!=null);return k?a[k]:f},v=>Number.isFinite(Number(v))?String(v):'未录');
  assert.equal(fmt({salary:[{resource:'钱',amount:38880},{resource:'粮',amount:32400}]}),'钱 38880 / 粮 32400');assert.equal(fmt({salary:{money:10,grain:0}}),'钱 10 / 粮 0');
  console.log('PASS opening letter normalization, explicit exam tiers, occurred-only news, structured army salary');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
