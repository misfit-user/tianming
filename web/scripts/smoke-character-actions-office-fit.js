#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(__dirname,'../..'),ref=process.argv.includes('--ref')?process.argv[process.argv.indexOf('--ref')+1]:null;
const read=p=>ref?cp.execFileSync('git',['show',ref+':'+p],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,p),'utf8');
let pass=0,fail=0;
function check(name,fn){try{fn();pass++;console.log('PASS',name);}catch(e){fail++;console.error('FAIL',name,e.message);}}
const els={},storage=new Map(),calls={letter:[],audience:[],legacy:[]};
function el(id){return els[id]||(els[id]={id,value:'',style:{},checked:false,innerHTML:'',textContent:'',scrollTop:0,
  classList:{add(){},remove(){},toggle(){}},appendChild(){},remove(){delete els[id];},focus(){},
  querySelector(s){return el(s.replace(/^#/,''));},querySelectorAll(){return [];}});}
const c={console,document:{getElementById:el,createElement:()=>el('new'),head:el('head'),body:el('body'),documentElement:el('html'),addEventListener(){},querySelectorAll(){return[];}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
  GM:{turn:2,chars:[],officeTree:[]},P:{playerInfo:{characterName:'君上'}},SettlementPipeline:{register(){}},
  _wdCanDirectAudience:ch=>ch.location==='临安',openWenduiPick:n=>calls.audience.push(n),switchGTab:(_,t)=>calls.legacy.push(t),
  TMPhase8FormalBridge:{drafts:{targetLetter:n=>calls.letter.push(n)}}};
c.window=c;vm.createContext(c);
['web/tm-office-system.js','web/tm-office-powermap.js','web/tm-renwu-tuzhi.js'].forEach(p=>vm.runInContext(read(p),c,{filename:p}));
vm.runInContext(functionSource(read('web/tm-office-panel.js'),'getOffNode'),c);
const ch={id:'person-a',name:'文臣甲',alive:true,age:40,location:'临安',administration:88,intelligence:70,management:90,military:20,valor:30,charisma:50,diplomacy:40,wuchang:{},wuchangOverride:{仁:80,义:90,礼:75,智:65,信:95}};
c.GM.chars=[ch,{id:'person-b',name:'武臣乙',age:38,alive:true,location:'江陵',military:90,administration:20}];
c.findCharByName=n=>c.GM.chars.find(x=>x.name===n)||null;
const tree=[{name:'中枢',positions:[{id:'occupied',name:'财赋长官',holder:'武臣乙',powers:{taxCollect:true}}],subs:[
  {name:'左路',positions:[{id:'left',name:'都尉',holder:'',powers:{militaryCommand:true}}]},
  {name:'右路',positions:[{id:'right',name:'都尉',holder:'',powers:{militaryCommand:true}}]},
  {name:'营造署',positions:[{id:'partial',name:'主事',headCount:3,actualCount:2,powers:{works:true}},{id:'full-anonymous',name:'书吏',establishedCount:2,actualHolders:[{name:'未具象甲',generated:false},{name:'未具象乙',generated:false}]}]}
]}];
c.GM.officeTree=tree;
const fit=()=>{assert(c.TM&&c.TM.OfficeFit,'requested OfficeFit provider absent at tested source');return c.TM.OfficeFit;};
check('all offices include occupied and nested distinct-name seats',()=>{const a=fit().list(c.GM,ch);assert.equal(a.length,5);assert(a.some(r=>r.position.id==='occupied'));assert.equal(a.filter(r=>r.position.name==='都尉').length,2);});
check('recommendations descending and use live scenario tree paths',()=>{const a=fit().list(c.GM,ch);for(let i=1;i<a.length;i++)assert(a[i-1].score>=a[i].score);for(const r of a)assert.equal(c.getOffNode(r.path),r.position);});
check('vacancy filter honors partial and unmaterialized occupancy',()=>{const a=fit().list(c.GM,ch,{vacantOnly:true});assert.equal(a.length,3);assert.equal(a.find(r=>r.position.id==='partial').stats.vacant,1);assert(!a.some(r=>r.position.id==='full-anonymous'||r.position.id==='occupied'));});
check('list does not migrate live objects or write ranking metadata to characters',()=>{const before=JSON.stringify(c.GM);fit().list(c.GM,ch);assert.equal(JSON.stringify(c.GM),before);assert.equal(ch._recommendScore,undefined);});
check('configured power takes precedence over misleading office name',()=>{const a=fit().score(ch,{name:'军署财官',powers:{works:true}},'军府');assert.equal(a.profile,'营造工程');});
check('numeric zero is zero not default 50',()=>{const a=fit().score({administration:0,intelligence:0,wuchang:{仁:0,义:0,礼:0,智:0,信:0}},{},'');assert.equal(a.score,0);assert.equal(a.missing.length,0);});
check('legacy numeric strings and empty-wuchang override read consistently',()=>{const a=fit().score(ch,tree[0].positions[0],'中枢');const b=fit().score({...ch,wuchang:{ren:'80',yi:'90',li:'75',zhi:'65',xin:'95'},wuchangOverride:undefined},tree[0].positions[0],'中枢');assert.equal(a.score,b.score);});
check('virtues change position-specific recommendation not loyalty',()=>{const a={administration:60,intelligence:60,management:60,military:60,valor:60,wuchang:{仁:0,义:0,礼:0,智:100,信:0}};const p={powers:{militaryCommand:true}},q={powers:{taxCollect:true}};assert(fit().score(a,p,'').score>fit().score(a,q,'').score);assert.equal(fit().score({...a,loyalty:0},p,'').score,fit().score({...a,loyalty:100},p,'').score);});
check('invalid/missing values produce finite marked estimates',()=>{const a=fit().score({administration:NaN,intelligence:Infinity,wuchang:{ren:'bad'}},{},'');assert(Number.isFinite(a.score)&&a.missing.length>0);});
check('ties retain deterministic tree order',()=>{const a=fit().list(c.GM,ch).filter(r=>r.position.name==='都尉');assert.deepEqual(Array.from(a,r=>r.position.id),['left','right']);});
check('read-only copies support frozen legacy inputs',()=>{const g=JSON.parse(JSON.stringify(c.GM));function freeze(o){Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v);});Object.freeze(o);}freeze(g);assert.equal(fit().list(g,g.chars[0]).length,5);});
check('changed abilities are reflected on next query without persistent cache',()=>{const p={powers:{militaryCommand:true}},a=fit().score(ch,p,'').score;const old=ch.military;ch.military=100;assert(fit().score(ch,p,'').score>a);ch.military=old;});
check('empty/cyclic department graphs finish without invented offices',()=>{assert.equal(fit().list({officeTree:[]},ch).length,0);const n={name:'甲',positions:[]};n.subs=[n];assert.equal(fit().list({officeTree:[n]},ch).length,0);});
for(const file of fs.readdirSync(path.join(root,'scenarios')).filter(f=>f.endsWith('（官方）.json'))){
  check('official authored office tree and character fields: '+file,()=>{
    const data=JSON.parse(fs.readFileSync(path.join(root,'scenarios',file),'utf8')),original=c.GM;
    const g={officeTree:data.officeTree,chars:data.characters};c.GM=g;
    try{const before=JSON.stringify(g),person=g.chars.find(x=>x&&!x.isPlayer&&x.alive!==false),rows=fit().list(g,person);
      let count=0;const walk=ns=>(ns||[]).forEach(n=>{count+=(n.positions||[]).filter(p=>p&&p.name).length;walk(n.subs);});walk(g.officeTree);
      assert(count>10);assert.equal(rows.length,count);assert(rows.every(r=>Number.isFinite(r.score)&&r.stats.vacant>=0));assert.equal(JSON.stringify(g),before);
    }finally{c.GM=original;}
  });
}

function open(name){c.TMZhiOpen(name||ch.name);return el('tm-zhi-folio').innerHTML;}
check('folio has exactly one audience and one letter action for away person',()=>{const html=open('武臣乙');assert.equal((html.match(/>鸿雁传书<\/button>/g)||[]).length,1);assert.equal((html.match(/>召入问对<\/button>/g)||[]).length,1);});
check('letter routes selected person to real formal adapter, never hidden legacy tab',()=>{open();c.TMZhi.act('letter');assert.equal(calls.letter.at(-1),ch.name);assert.equal(calls.legacy.length,0);});
check('audience opens existing selection and closes character overlay',()=>{open();c.TMZhi.act('wendui');assert.equal(calls.audience.at(-1),ch.name);assert.equal(el('tm-zhi-overlay').style.display,'none');});
check('missing route stays visible with actionable failure instead of success',()=>{open();const d=c.TMPhase8FormalBridge.drafts;delete d.targetLetter;try{c.TMZhi.act('letter');assert.equal(el('tm-zhi-overlay').style.display,'grid');assert(el('tm-zhi-toast').textContent.includes('未提交'));}finally{d.targetLetter=n=>calls.letter.push(n);}});
check('pin control visibly toggles and can undo',()=>{open();try{c.TMZhi.pin();assert(el('tm-zhi-folio').innerHTML.includes('取消钉选'));assert(el('tm-zhi-folio').innerHTML.includes('aria-pressed="true"'));c.TMZhi.pin();assert(!el('tm-zhi-folio').innerHTML.includes('取消钉选'));}finally{storage.clear();}});
check('relations resets comparison view and scroll position',()=>{open();c.TMZhi.setCompare('武臣乙');el('tm-zhi-main').scrollTop=500;c.TMZhi.switchTab('relations');assert(el('tm-zhi-main').innerHTML.includes('关 系 强 弱'));assert.equal(el('tm-zhi-main').scrollTop,0);});
check('office button displays all ranked offices and toggles vacancies in same view',()=>{open();const before=JSON.stringify(c.GM);c.TMZhi.act('office');assert(el('tm-zhi-main').innerHTML.includes('任 官 参 考'));assert(el('tm-zhi-main').innerHTML.includes('财赋长官'));c.TMZhi.filterOffices(true);assert(!el('tm-zhi-main').innerHTML.includes('财赋长官'));assert.equal(JSON.stringify(c.GM),before);});
check('changed office path cannot silently hand off to a different position',()=>{open();c.TMZhi.act('office');const old=c.GM.officeTree;c.GM.officeTree=JSON.parse(JSON.stringify(old));try{assert.equal(c.TMZhi.pickOffice(0),false);}finally{c.GM.officeTree=old;}});
check('ambiguous legacy department and post names fail closed',()=>{const extra={name:'中枢',positions:[{name:'财赋长官',powers:{taxCollect:true}}]};c.GM.officeTree.push(extra);try{open();c.TMZhi.act('office');const rows=fit().list(c.GM,ch),i=rows.findIndex(r=>r.deptName==='中枢'&&r.position.name==='财赋长官');assert.equal(c.TMZhi.pickOffice(i),false);}finally{c.GM.officeTree.pop();}});
check('world switch rejects stale actions even with same names and turn',()=>{open();const old=c.GM,n=calls.letter.length;c.GM=JSON.parse(JSON.stringify(old));c.GM._pendingLetterTo='武臣乙';const before=JSON.stringify(c.GM);try{c.TMZhi.act('letter');assert(JSON.stringify(c.GM)===before,'stale action changed current world');assert.equal(calls.letter.length,n);}finally{c.GM=old;}});
check('duplicate live names cannot silently bind to first character',()=>{const other={...ch,id:'different'};c.GM.chars.push(other);open();const n=calls.audience.length;try{c.TMZhi.act('wendui');assert.equal(calls.audience.length,n);}finally{c.GM.chars.pop();}});
check('death and self have no active appointment or audience entry',()=>{c.GM.chars.push({id:'dead',name:'故人',alive:false},{id:'player',name:'君上',isPlayer:true});assert(!open('故人').includes('官制任免'));assert(!open('君上').includes('召入问对'));c.GM.chars.splice(-2);});
console.log(`[smoke-character-actions-office-fit] ${pass} PASS / ${fail} FAIL`);process.exitCode=fail?1:0;
