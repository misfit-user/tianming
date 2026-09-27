import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import assert from 'node:assert/strict';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.TM_TEST_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const overlay=process.env.TM_TEST_OVERLAY;
const read=f=>fs.readFileSync(overlay&&fs.existsSync(path.join(overlay,f))?path.join(overlay,f):path.join(root,f),'utf8');
const {functionSource}=(await import(pathToFileURL(path.join(root,'web/scripts/lib-perf-round1.js')))).default;
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' '+e.stack);}}
function harness(){
 const nodes={},calls={audience:[],letter:[],rebuild:0},storage=new Map();
 function node(id=''){return{id,value:'',style:{},checked:false,innerHTML:'',textContent:'',scrollTop:0,
  classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},
  appendChild(n){if(n.id)nodes[n.id]=n;},remove(){delete nodes[this.id];},
  querySelector(s){return s.startsWith('#')?(nodes[s.slice(1)]||(nodes[s.slice(1)]=node(s.slice(1)))):null;},querySelectorAll(){return[];}};}
 const person={id:'a',name:'甲臣',sid:'fixture',alive:true,location:'京城',faction:'本朝',age:40,officialTitle:'尚书',loyalty:60};
 const c={console,GM:{sid:'fixture',turn:5,chars:[person],allCharacters:[],officeTree:[]},P:{playerInfo:{characterName:'君上'},characters:[]},
  document:{getElementById:id=>nodes[id]||null,createElement:()=>node(),body:node('body'),head:node('head'),documentElement:node('html'),addEventListener(){},querySelectorAll(){return[];}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
  _tmLoadGen:1,_tmStartPrewarmEpoch:1,_wdCanDirectAudience:ch=>ch.location==='京城',
  openWenduiPick:n=>{calls.audience.push(n);nodes['wd-pick-modal']=node('wd-pick-modal');},
  TMPhase8FormalBridge:{drafts:{targetLetter:n=>calls.letter.push(n)}},toast(){}};
 c.findCharByName=n=>c.GM.chars.find(p=>p.name===n);c.window=c;vm.createContext(c);
 vm.runInContext(read('web/tm-renwu-tuzhi.js'),c,{filename:'tm-renwu-tuzhi.js'});
 return{c,person,calls,nodes,open:()=>c.TMZhiOpen(person.name),act:(kind='wendui')=>c.TMZhi.act(kind)};
}
test('unique live person opens the picker',()=>{
 const h=harness();h.open();assert.equal(h.act(),true);assert.deepEqual(h.calls.audience,['甲臣']);
});
test('startup display projection is not a duplicate person',()=>{
 const h=harness(),start=read('web/tm-patches-start.js');
 const line=start.split('\n').find(s=>s.trim().startsWith('GM.allCharacters=GM.chars.map'));
 assert(line);vm.runInContext(line,h.c);
 assert.notEqual(h.c.GM.allCharacters[0],h.person);assert.equal(h.c.GM.allCharacters[0].id,undefined);
 h.open();assert.equal(h.act(),true);assert.equal(h.calls.audience[0],'甲臣');
});
test('display copies do not block live character actions',()=>{
 for(const kind of ['wendui','letter','office']){
  const h=harness();h.c.GM.allCharacters=[{...h.person},{...h.person}];h.open();assert.equal(h.act(kind),true,kind);
 }
});
test('actual duplicate live names remain rejected',()=>{
 const h=harness();h.c.GM.chars.push({...h.person,id:'b'});h.open();
 assert.equal(h.act(),false);assert.equal(h.calls.audience.length,0);assert.equal(h.nodes['tm-zhi-overlay'].style.display,'grid');
});
test('display-only records never become active characters',()=>{
 for(const source of ['allCharacters','scenario']){
  const h=harness();h.c.GM.chars=[];
  if(source==='allCharacters')h.c.GM.allCharacters=[h.person];else h.c.P.characters=[h.person];
  h.open();const before=JSON.stringify(h.c.GM);
  assert.equal(h.act(),false);assert.equal(JSON.stringify(h.c.GM),before);assert.equal(h.calls.audience.length,0);
 }
});
test('same-ID roster replacement refreshes the selected actor',()=>{
 const h=harness();h.open();h.c.GM.chars=[{...h.person,officialTitle:'新职'}];
 assert.equal(h.act(),true);assert.equal(h.calls.audience[0],'甲臣');
});
test('different replacement ID cannot inherit the old selection',()=>{
 const h=harness();h.open();h.c.GM.chars=[{...h.person,id:'replacement'}];
 assert.equal(h.act(),false);assert.equal(h.calls.audience.length,0);
});
test('stable-ID rename routes to the current name',()=>{
 const h=harness();h.open();h.c.GM.chars=[{...h.person,name:'甲臣新名'}];
 assert.equal(h.act(),true);assert.deepEqual(h.calls.audience,['甲臣新名']);
});
test('updated life status overrides cached live cards',()=>{
 for(const flag of ['alive','dead']){
  const h=harness();h.open();h.person[flag]=flag==='alive'?false:true;
  assert.equal(h.act(),false);assert.equal(h.calls.audience.length,0);
 }
});
test('world replacement and in-place load epochs invalidate cards',()=>{
 for(const kind of ['world','scenario','load','start']){
  const h=harness();h.open();
  if(kind==='world')h.c.GM=JSON.parse(JSON.stringify(h.c.GM));if(kind==='scenario')h.c.GM.sid='other';
  if(kind==='load')h.c._tmLoadGen++;if(kind==='start')h.c._tmStartPrewarmEpoch++;
  assert.equal(h.act(),false,kind);assert.equal(h.calls.audience.length,0);
 }
});
test('stale index is rebuilt before the action',()=>{
 const h=harness();h.open();const fresh={...h.person};h.c.GM.chars=[fresh];let indexed=h.person;
 h.c.findCharByName=()=>indexed;h.c.buildIndices=()=>{h.calls.rebuild++;indexed=fresh;};
 assert.equal(h.act(),true);assert.equal(h.calls.rebuild,1);
});
test('unresolved stale index cannot target the old record',()=>{
 const h=harness();h.open();h.c.GM.chars=[{...h.person}];h.c.findCharByName=()=>h.person;
 assert.equal(h.act(),false);assert.equal(h.calls.audience.length,0);
});
test('duplicate stable IDs are rejected',()=>{
 const h=harness();h.c.GM.chars.push({...h.person,name:'乙臣'});h.open();assert.equal(h.act(),false);
});
test('ID-less legacy record requires its original object',()=>{
 const h=harness();delete h.person.id;h.open();assert.equal(h.act(),true);
 h.open();h.c.GM.chars=[{...h.person}];assert.equal(h.act(),false);
});
test('missing picker leaves the roster visible',()=>{
 const h=harness();h.open();h.c.openWenduiPick=()=>{};
 assert.equal(h.act(),false);assert.equal(h.nodes['tm-zhi-overlay'].style.display,'grid');
});
function pickerHarness(){
 const h=harness();h.calls.dialogue=[];
 h.c._$=id=>h.nodes[id]||null;h.c.escHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 h.c._wdIsPlayerConsort=()=>false;h.c._wdPickedMode='private';
 h.c.openWenduiModal=(name,mode)=>h.calls.dialogue.push({name,mode});
 const source=read('web/tm-wendui.js');
 vm.runInContext(['openWenduiPick','_wdConfirmPick'].map(n=>functionSource(source,n)).join('\n'),h.c);
 return h;
}
test('picker uses its captured target and resets the visible default mode',()=>{
 const h=pickerHarness();h.c.openWenduiPick('甲臣');h.c._wdConfirmPick();
 assert.deepEqual(h.calls.dialogue,[{name:'甲臣',mode:'formal'}]);assert.equal(h.nodes['wd-pick-modal'],undefined);
});
test('confirmation after a world or generation change never opens dialogue',()=>{
 for(const kind of ['world','scenario','load','start']){
  const h=pickerHarness();h.c.openWenduiPick('甲臣');
  if(kind==='world')h.c.GM=JSON.parse(JSON.stringify(h.c.GM));if(kind==='scenario')h.c.GM.sid='other';
  if(kind==='load')h.c._tmLoadGen++;if(kind==='start')h.c._tmStartPrewarmEpoch++;
  assert.equal(h.c._wdConfirmPick('甲臣'),false,kind);assert.equal(h.calls.dialogue.length,0);
 }
});
test('confirmation cannot switch to a same-name replacement',()=>{
 const h=pickerHarness();h.c.openWenduiPick('甲臣');h.c.GM.chars=[{...h.person,id:'b'}];
 assert.equal(h.c._wdConfirmPick('甲臣'),false);assert.equal(h.calls.dialogue.length,0);
});
test('confirmation follows a same-ID rename',()=>{
 const h=pickerHarness();h.c.openWenduiPick('甲臣');h.c.GM.chars=[{...h.person,name:'新名'}];
 h.c._wdConfirmPick();assert.deepEqual(h.calls.dialogue,[{name:'新名',mode:'formal'}]);
});
test('new live namesakes block confirmation',()=>{
 const h=pickerHarness();h.c.openWenduiPick('甲臣');h.c.GM.chars.push({...h.person,id:'b'});
 assert.equal(h.c._wdConfirmPick(),false);assert.equal(h.calls.dialogue.length,0);
});
test('dismissed picker cannot be confirmed twice',()=>{
 const h=pickerHarness();h.c.openWenduiPick('甲臣');h.c._wdConfirmPick();
 assert.equal(h.c._wdConfirmPick(),false);assert.equal(h.calls.dialogue.length,1);
});
test('quoted names are not interpolated into executable handlers',()=>{
 const h=pickerHarness();h.person.name="O'测试";h.c.openWenduiPick(h.person.name);
 assert(h.nodes['wd-pick-modal'].innerHTML.includes('onclick="_wdConfirmPick()"'));
 h.c._wdConfirmPick();assert.equal(h.calls.dialogue[0].name,h.person.name);
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
