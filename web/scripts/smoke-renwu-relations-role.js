#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(path.resolve(__dirname,'../tm-renwu-tuzhi.js'),'utf8');
let checks = 0;
function ok(value, message) { assert(value, message); checks++; }
function harness(chars, affinity) {
  const elements = {};
  const el = id => elements[id] || (elements[id] = {id,value:'',checked:false,style:{},innerHTML:'',textContent:'',classList:{add(){},remove(){}},appendChild(){},remove(){},addEventListener(){},querySelector:bySel,querySelectorAll:()=>[],scrollTop:0,focus(){}});
  function bySel(s) { return el(s.charAt(0)==='#'?s.slice(1):'__'+s); }
  const context = {
    console,Math,JSON,RegExp,Array,Object,String,Number,Boolean,parseInt,parseFloat,isNaN,isFinite,Date,
    setTimeout(fn){if(typeof fn==='function')fn();return 0;},clearTimeout(){},setInterval(){return 0;},clearInterval(){},
    document:{getElementById:el,querySelector:bySel,querySelectorAll:()=>[],createElement:()=>el('__tmp'),body:el('__body'),head:el('__head'),documentElement:{style:{}},addEventListener(){}},
    GM:{turn:1,chars,characterArcs:{},culturalWorks:[]},P:{characters:[],playerInfo:{characterName:'李瀍'}},
    AffinityMap:{getRelations:name=>(affinity&&affinity[name])||[]},
    NPC_RELATION_LABELS:{poet_friend:{label:'诗友'},friend:{label:'朋友'}},
    findCharByName:name=>chars.find(c=>c&&c.name===name)||null,
    getCharacterRankLabel:c=>c.officeRankText||'',getRankLevel:()=>9,
    buildIndices(){},renderOfficeTree(){},toast(){},confirm:()=>true
  };
  context.window=context;context.globalThis=context;vm.createContext(context);
  vm.runInContext(source,context,{filename:'tm-renwu-tuzhi.js'});
  return {context,el,html:id=>el(id).innerHTML};
}

const peers=['刘禹锡','牛僧孺','白敏中','李宗闵','杜牧','裴休','李商隐','郑覃','杨嗣复'];
const bai={name:'白居易',officialTitle:'太子少傅',concurrentTitles:['分司东都'],officeRankText:'从二品',rosterRole:'civil',faction:'唐朝廷',alive:true,administration:30,military:90,relations:{},_relationships:{刘禹锡:[{strength:80,type:'friend'}]}};
peers.forEach((name,i)=>{bai.relations[name]={affinity:80,trust:60,respect:65,fear:0,hostility:0,labels:[i===0?'poet_friend':i===2?'从弟':'旧交'],desc:i===0?'与刘禹锡互寄诗篇，<席间笑语>仍在耳边。':''};});
const chars=[
  {name:'李瀍',isPlayer:true,rosterRole:'harem',title:'皇帝',alive:true},bai,
  {name:'仇士良',officialTitle:'左神策军中尉',rosterRole:'harem',faction:'唐朝廷',military:95,administration:20,alive:true},
  {name:'王才人',officialTitle:'才人',rosterRole:'harem',faction:'唐朝廷',alive:true},
  {name:'纸杏',officialTitle:'龟兹旅舍女主人',rosterRole:'bu',faction:'安西绿洲诸城',military:99,administration:10,alive:true},
  {name:'陆文远',officialTitle:'神策军营将',rosterRole:'mili',faction:'唐朝廷',military:10,administration:99,alive:true},
  {name:'已殁者',officialTitle:'州吏',rosterRole:'civil',alive:false},
  ...peers.map(name=>({name,rosterRole:'bu',title:'寄居士人',alive:true}))
];
const before=JSON.stringify(chars);
const h=harness(chars,{白居易:[{name:'刘禹锡',value:0}]});
h.context.TMZhi.selectP('白居易');
let folio=h.html('tm-zhi-folio');
ok(!folio.includes('暂无显性关系'),'relations seed reaches right sidebar');
ok(folio.includes('刘禹锡')&&folio.includes('诗友')&&folio.includes('白敏中')&&folio.includes('从弟'),'specific labels survive scalar merge');
ok(folio.includes('<span class="sc">0</span>')&&!folio.includes('<span class="sc">+80</span>'),'dynamic zero does not fall back to obsolete strength');
h.context.TMZhi.switchTab('relations');
let main=h.html('tm-zhi-main');
const full=main.split('关 系 强 弱 细 览')[1].split('</section>')[0];
peers.forEach(name=>ok(full.includes('<span class="nm">'+name+'</span>'),'all seeded relations visible: '+name));
ok((full.match(/<span class="nm">刘禹锡<\/span>/g)||[]).length===1,'same counterpart is not duplicated across sources');
ok(main.includes('&lt;席间笑语&gt;')&&!main.includes('<席间笑语>'),'relation-specific prose is visible and escaped');
ok(!full.includes('null')&&!full.includes('undefined'),'vector-only ties do not print missing scalar values');
ok(!full.includes('<span class="sc">+80</span>'),'five-dimensional affinity is not silently treated as signed affinity-map value');
ok(!/AffinityMap|OpinionSystem|引擎五维/.test(main),'relation chrome contains no implementation names');
ok(JSON.stringify(chars)===before,'adapters leave original relationships, labels and cast untouched');

h.context.TMZhi.quickStat('all');
const stats=h.html('tm-zhi-statbar');
ok(stats.includes('<b>15</b><span>在世</span>'),'all living categories contribute to living count');
for(const [count,label] of [[1,'文职'],[1,'武职'],[3,'内廷'],[10,'布衣'],[1,'已殁']])ok(stats.includes('<b>'+count+'</b><span>'+label+'</span>'),'correct '+label+' count');
ok(!stats.includes('在朝'),'world roster does not call every foreign/common character a court officer');
h.context.TMZhi.quickStat('harem');
ok(['仇士良','王才人','李瀍'].every(n=>h.html('tm-zhi-roster').includes(n))&&!h.html('tm-zhi-roster').includes('纸杏'),'court identity comes from explicit field');
h.context.TMZhi.quickStat('mili');
ok(h.html('tm-zhi-roster').includes('陆文远')&&!h.html('tm-zhi-roster').includes('白居易'),'military identity is not an attribute comparison');
h.context.TMZhi.quickStat('bu');
ok(h.html('tm-zhi-roster').includes('纸杏')&&!h.html('tm-zhi-roster').includes('王才人'),'nonempty occupational title does not grant office status');
h.context.TMZhi.selectP('纸杏');h.context.TMZhi.switchTab('identity');
ok(h.html('tm-zhi-main').includes('生 计 与 身 份')&&!h.html('tm-zhi-main').includes('公 职 身 份'),'private livelihood is not labeled a public office');
h.context.TMZhi.selectP('王才人');h.context.TMZhi.switchTab('identity');
ok(h.html('tm-zhi-main').includes('内 廷 与 宗 室'),'consort identity is not labeled a civil office');
h.context.TMZhi.selectP('白居易');
main=h.html('tm-zhi-main');
ok(main.includes('太子少傅')&&main.includes('分司东都')&&main.includes('从二品'),'actual primary/concurrent office and grade remain visible');
chars.find(c=>c.name==='纸杏').rosterRole='civil';
h.context.TMZhi.invalidatePeople();
ok(h.html('tm-zhi-statbar').includes('<b>2</b><span>文职</span>'),'invalidation refreshes classification totals as well as cards');
ok(!source.includes('>roster · 检索 · 派系<')&&source.includes('>名籍 · 检索 · 派系<'),'roster subheading is Chinese');

// Other scenarios without the new authoring field retain their existing grouping.
const legacy=harness([
 {name:'旧文官',officialTitle:'县令',administration:70,military:20},
 {name:'旧军将',officialTitle:'军将',administration:20,military:70},
 {name:'旧宫人',faction:'后宫',title:'才人'},
 {name:'旧布衣'}
]);
legacy.context.TMZhi.selectP('旧文官');legacy.context.TMZhi.quickStat('all');
for(const label of ['文职','武职','内廷','布衣'])ok(legacy.html('tm-zhi-statbar').includes('<b>1</b><span>'+label+'</span>'),'legacy category retained: '+label);
const malformed=harness([{name:'边例人物',rosterRole:'bu',relations:{坏记录:null,坏文本:'旧交',好记录:{labels:['同乡']}},_relationships:{错数组:{strength:90}}}],{边例人物:[{name:'坏数字',value:'NaN'},{name:'新交',value:45}]});
malformed.context.TMZhi.selectP('边例人物');malformed.context.TMZhi.switchTab('relations');
ok(malformed.html('tm-zhi-main').includes('好记录')&&malformed.html('tm-zhi-main').includes('同乡'),'one malformed source does not hide a person or valid relations');
ok(!/坏记录|坏文本|坏数字|错数组/.test(malformed.html('tm-zhi-main')),'malformed sources do not invent counterpart entries');
ok(malformed.html('tm-zhi-main').includes('<span class="sc">+45</span>'),'existing scalar-only affinity entry continues to display');
if (process.argv.includes('--scenario')) {
  const scenario=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../scenarios/晚唐·开成五年（官方）.json'),'utf8'));
  const cast=scenario.characters;
  ok(cast.every(c=>['civil','mili','harem','bu'].includes(c.rosterRole)),'every installed-source actor has an explicit valid category');
  const real=harness(cast);
  real.context.P.playerInfo=scenario.playerInfo;
  real.context.TMZhi.selectP('白居易');
  ok(real.html('tm-zhi-folio').includes('刘禹锡')&&real.html('tm-zhi-folio').includes('从弟'),'canonical Bai relationships reach sidebar');
  real.context.TMZhi.quickStat('all');
  const expected={civil:0,mili:0,harem:0,bu:0};cast.filter(c=>c.alive!==false).forEach(c=>expected[c.rosterRole]++);
  for(const [role,label] of Object.entries({civil:'文职',mili:'武职',harem:'内廷',bu:'布衣'}))ok(real.html('tm-zhi-statbar').includes('<b>'+expected[role]+'</b><span>'+label+'</span>'),'canonical category is rendered: '+role);
  ok(real.html('tm-zhi-statbar').includes('<b>'+cast.filter(c=>c.alive!==false).length+'</b><span>在世</span>'),'canonical total includes all living identities');
  console.log('[canonical roster]',JSON.stringify({characters:cast.length,counts:expected}));
}
console.log('[smoke-renwu-relations-role] PASS '+checks+' assertions');
