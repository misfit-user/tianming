#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(__dirname,'../..'),at=process.argv.indexOf('--source-ref'),ref=at>=0?process.argv[at+1]:null;
const source=ref?cp.execFileSync('git',['show',ref+':web/phase8-formal-rightrail.js'],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'web/phase8-formal-rightrail.js'),'utf8');
const names=['rightIssueFirst','rightArmyFirst','rightArmyName','rightArmyType','rightArmyKey','rightArmyCommander','rightArmyLocation','rightArmySearchState','rightArmySearchText','rightFilterArmyRows','rightArmyRowsForRender','rightFindArmyRow','rightBuildArmyGroups','rightSliceArmyGroups','rightArmyGroupsHtml','rightScheduleArmyListHydration','rightUpdateArmySearch','renderArmy','bindRightPanelActions'];
const functions=names.filter(n=>source.includes('function '+n+'(')).map(n=>functionSource(source,n)).join('\n');
let pass=0,fail=0;function test(name,fn){try{fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}}
function fixture(){
 const armies=Array.from({length:40},(_,i)=>({id:'a'+i,name:'京营 '+i,commander:'将领'+i,location:'京师',armyType:'步军',soldiers:100+i}));
 armies[39]={id:'tail',name:'辽东骑军 😀',commanderName:'张辽',garrison:'辽阳',armyType:'骑兵',soldiers:900};
 const tasks=[],events={},esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const list={attrs:{'data-army-list-token':'old'},innerHTML:'initial',scrollTop:100,setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];}};
 const count={textContent:''},clear={disabled:true,closest:()=>shell},input={value:'',_tmArmyComposing:false,matches:s=>s==='[data-army-search]',closest:()=>shell,focus(){this.focused=true;}};
 const shell={isConnected:true,owner:'',getAttribute(){return this.owner;},querySelector(s){return s==='[data-army-list-token]'?list:s==='[data-army-search-count]'?count:s==='[data-army-search-clear]'?clear:s==='[data-army-search]'?input:null;}};
 const host={addEventListener(n,f){events[n]=f;}};
 const c={console,JSON,Map,Set,GM:{sid:'s',turn:2,armies},P:{},state:{selectedArmy:'a0'},_rightArmySearch:null,_rightArmySearchSeq:0,_rightArmyRenderSeq:0,RIGHT_ARMY_INITIAL_ROWS:36,esc,attr:esc,
  rightArmyList:()=>armies,rightArmySoldiers:a=>a.soldiers,rightArmyFmtNum:n=>String(n),rightArmyMoraleValue:()=>60,rightArmyPercent:()=>60,rightArmySupplyValue:()=>70,rightGuozuoCard:()=>'',rightArmoryCard:()=>'',rightRovingCard:()=>'',
  setTimeout:f=>tasks.push(f),document:{querySelector(s){const m=s.match(/data-army-list-token="([^"]+)"/);return m&&m[1]===list.attrs['data-army-list-token']?list:null;}},handleRightPanelAction(){},rightActionData:b=>b.dataset};
 c.window=c;vm.createContext(c);vm.runInContext(functions,c);
 function enable(){assert.equal(typeof c.rightArmySearchState,'function');shell.owner=c.rightArmySearchState().token;}
 return{c,armies,tasks,input,list,count,clear,shell,host,events,enable,rows:()=>c.rightArmyRowsForRender(armies)};
}
test('default roster retains full totals and first-page deferred rendering',()=>{const f=fixture(),html=f.c.renderArmy();assert(html.includes('部队名册·40'));assert(html.includes('余下部队正在载入'));assert.equal(f.tasks.length,1);});
test('search control has visible guidance and total/matched count',()=>{const f=fixture(),html=f.c.renderArmy();assert(html.includes('data-army-search'));assert(html.includes('搜索部队名称、统帅、驻地或兵种'));assert(html.includes('显示 40 / 40 支'));});
test('name commander location type and id find the same actual row, including after row36',()=>{const f=fixture();for(const query of ['辽东','张辽','辽阳','骑兵','tail','😀'])assert.deepEqual(Array.from(f.c.rightFilterArmyRows(f.rows(),query),r=>r.key),['tail']);});
test('multiword AND, normalized width/case, blank and literal regex characters',()=>{const f=fixture();assert.equal(f.c.rightFilterArmyRows(f.rows(),'辽东 张辽').length,1);assert.equal(f.c.rightFilterArmyRows(f.rows(),'辽东 京师').length,0);assert.equal(f.c.rightFilterArmyRows(f.rows(),'ＴＡＩＬ').length,1);assert.equal(f.c.rightFilterArmyRows(f.rows(),'　 ').length,40);assert.equal(f.c.rightFilterArmyRows(f.rows(),'[').length,0);});
test('filter before hydration includes a formerly deferred match without reducing summary totals',()=>{const f=fixture();f.enable();f.c.rightArmySearchState().query='张辽';const html=f.c.renderArmy();assert(html.includes('data-id="tail"'));assert(!html.includes('data-id="a0"'));assert(html.includes('部队名册·40'));assert(html.includes('显示 1 / 40 支'));assert.equal(f.tasks.length,0);});
test('search text is escaped in attribute markup',()=>{const f=fixture();f.enable();f.c.rightArmySearchState().query='"><img src=x onerror=alert(1)>';const html=f.c.renderArmy();assert(!html.includes('<img src=x'));assert(html.includes('&quot;&gt;&lt;img'));});
test('input refresh only changes list/count and invalidates older hydration',()=>{const f=fixture();f.enable();f.c.rightScheduleArmyListHydration('old',f.c.rightBuildArmyGroups(f.rows()),'a0');f.input.value='张辽';const before=JSON.stringify(f.c.GM);f.c.rightUpdateArmySearch(f.input);const filtered=f.list.innerHTML;f.tasks.forEach(fn=>fn());assert.equal(f.list.innerHTML,filtered);assert(filtered.includes('data-id="tail"'));assert.equal(f.count.textContent,'显示 1 / 40 支');assert.equal(f.input.value,'张辽');assert.equal(f.c.state.selectedArmy,'a0');assert.equal(JSON.stringify(f.c.GM),before);});
test('composition stays untouched until end, then searches final Chinese text',()=>{const f=fixture();f.enable();f.c.bindRightPanelActions(f.host);f.events.compositionstart({target:f.input});f.input.value='zhang';f.events.input({target:f.input,isComposing:true});assert.equal(f.list.innerHTML,'initial');f.input.value='张辽';f.events.compositionend({target:f.input});assert.equal(f.count.textContent,'显示 1 / 40 支');});
test('clear restores rows and returns focus without reopening the drawer',()=>{const f=fixture();f.enable();f.c.bindRightPanelActions(f.host);f.input.value='张辽';f.events.input({target:f.input});f.events.click({target:{closest:s=>s==='[data-army-search-clear]'?f.clear:null},preventDefault(){},stopPropagation(){}});assert.equal(f.input.value,'');assert.equal(f.count.textContent,'显示 40 / 40 支');assert(f.input.focused);assert.equal(f.c.state.selectedArmy,'a0');});
test('old-world input cannot leak query to replacement or in-place load',()=>{for(const mutate of [c=>c.GM={sid:'new'},c=>c.P={},c=>c._tmLoadGen=1,c=>c.GM._timelineId='other']){const f=fixture();f.enable();f.input.value='张辽';mutate(f.c);f.c.rightUpdateArmySearch(f.input);assert.equal(f.c.rightArmySearchState().query,'');assert.equal(f.list.innerHTML,'initial');}});
test('same-world reopen remembers query and empty results remain explicit',()=>{const f=fixture();f.enable();f.c.rightArmySearchState().query='不存在';assert(f.c.renderArmy().includes('未找到匹配部队'));assert(f.c.renderArmy().includes('value="不存在"'));});
console.log(JSON.stringify({PASS:pass,FAIL:fail,SKIP:0,WAIVED:0,sourceRef:ref||'worktree'}));process.exitCode=fail?1:0;
