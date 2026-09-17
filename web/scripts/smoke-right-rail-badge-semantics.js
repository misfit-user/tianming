#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const {functionSource}=require('./lib-perf-round1');
// Parse each selected production function once, not once per fixture/world.
// Reuse the same extracted bytes; all behavioral assertions still run per case.
const extracted=new Map();
function selectedFn(source,name){let fns=extracted.get(source);if(!fns){fns=new Map();extracted.set(source,fns);}if(!fns.has(name))fns.set(name,functionSource(source,name));return fns.get(name);}
const root=path.resolve(__dirname,'../..'),ref=process.argv.includes('--ref')?process.argv[process.argv.indexOf('--ref')+1]:null;
const source=ref?cp.execFileSync('git',['show',ref+':web/phase8-formal-bridge.js'],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'web/phase8-formal-bridge.js'),'utf8');
const read=f=>ref?cp.execFileSync('git',['show',ref+':web/'+f],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'web',f),'utf8');
const rail=read('phase8-formal-rightrail.js'),wendui=read('tm-wendui.js');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.message);}}
function harness(){
  const elements=new Map(),badges=[],calls=[];let reads=0;
  function badge(owner,slot,cls){const b={owner,slot,cls,textContent:'',style:{},removed:false,getAttribute:k=>k==='data-phase8-badge'?slot:null,parentNode:{attrs:{},setAttribute(k,v){this.attrs[k]=v;}},remove(){this.removed=true;}};badges.push(b);return b;}
  function node(id){let html='';const n={id,style:{},dataset:{},setAttribute(){},querySelector(s){return s==='[data-slot="archive"]'&&html.includes('data-slot="archive"')?{}:null;},appendChild(child){elements.set(child.id,child);},remove(){elements.delete(this.id);badges.filter(b=>b.owner===this.id).forEach(b=>b.remove());},
    get innerHTML(){return html;},set innerHTML(v){html=v;badges.filter(b=>b.owner===this.id).forEach(b=>b.remove());for(const m of v.matchAll(/<span class="(tm-rc-count|tmf-rail-count)"(?: data-phase8-badge="([^"]+)")?/g))badge(this.id,m[2],m[1]);}};return n;}
  const parent=node('parent');
  const doc={querySelector:s=>s==='.gs-rail-right'?parent:null,getElementById:id=>elements.get(id)||null,createElement:()=>node(''),
    querySelectorAll(s){
      const slot=/^\[data-phase8-badge="([^"]+)"\]$/.exec(s);
      if(slot)return badges.filter(b=>!b.removed&&b.slot===slot[1]);
      return badges.filter(b=>!b.removed&&((b.owner==='tm-right-rail'&&s.includes('#tm-right-rail .tm-rc-count'))||(b.owner==='tm-phase8-formal-rail'&&s.includes('#tm-phase8-formal-rail .tmf-rail-count'))));
    }};
  const c={document:doc,state:{pinnedPeople:['old-a','old-b','old-c','old-d','old-e','old-f']},GM:{_junqingBrief:[1,2,3]},
    esc:s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),syncFormalShellVisibility:()=>true,updateRailActive(){},
    getMemorials(){reads++;return Array.from({length:12},()=>({status:'pending'}));},getIssues(){reads++;return Array.from({length:6},()=>({status:'pending'}));},issueIsResolved:x=>x.status==='resolved',collectRecentEvents(){reads++;return[1,2,3,4];},TMPhase8FormalBridge:{openPanel:s=>calls.push(s)}};
  c.window=c;vm.createContext(c);
  c.GM.turn=2;c.GM.chars=[{id:'a',name:'甲',alive:true,location:'京师',stress:80,loyalty:60},{id:'b',name:'乙',alive:true,location:'京师',stress:0,loyalty:60}];
  c.GM._pendingAudiences=[{name:'使臣',isEnvoy:true,_qid:'envoy'},{name:'乙',_qid:'b'}];
  c.GM.letters=[];c.personKey=p=>String(p.id||p.name);c.findPerson=k=>(c.GM.chars||[]).find(p=>p.id===k||p.name===k);c.findCharByName=c.findPerson;
  c.rightIssuePeople=()=>c.GM.chars||[];c.rightIssueIsPlayerConsort=p=>!!p.playerConsort;c._tmIsForeignCourtChar=p=>p.foreign===true;
  c.toast=()=>{};c.renderWenduiChars=()=>c.updateRailBadges();c.openPanel=s=>c.TMPhase8FormalBridge.openPanel(s);c.panelHost=()=>parent;
  for(const n of ['rightIssueFirst','rightIssueNum','rightIssueAtCourt','rightWenduiHasUnansweredLetter','rightWenduiIsSeeker','rightWenduiKeepPending','rightWenduiPendingState'])if(rail.includes('function '+n+'('))vm.runInContext(selectedFn(rail,n),c);
  for(const n of ['_wdDeriveAudienceAgenda','_wdResolvePending','_wdRemovePendingAudience','_wdCleansePendingAudiences','_wdDenyAudience','_wdDismissPending'])vm.runInContext(selectedFn(wendui,n),c);
  if(c.rightWenduiPendingState)c.TMPhase8FormalBridge.rightrail={pendingAudiences:c.rightWenduiPendingState};
  // Load optional old dependencies only when present, so the same harness can
  // execute the actual pre-fix renderers as a red baseline (not replacement code).
  const legacy=source.match(/var RAIL_DYNAMIC_BADGE_SLOTS\s*=\s*\{[^}]*\};/);
  const names=['updateRailBadges','ensureRail','ensurePreviewRail'];
  for(const n of ['railAudienceCount','openRailPanel'])if(source.includes('function '+n+'('))names.push(n);
  if(legacy){vm.runInContext(legacy[0],c);names.unshift('railDynamicBadgeCount');}
  vm.runInContext(names.map(n=>selectedFn(source,n)).join('\n'),c);
  c.TMPhase8FormalBridge.openRailPanel=c.openRailPanel;
  return{c,elements,badges,calls,badge,reads:()=>reads,live:()=>badges.filter(b=>!b.removed)};
}
for(const [fn,id]of [['ensureRail','tm-phase8-formal-rail'],['ensurePreviewRail','tm-right-rail']]){
  const h=harness();h.c[fn]();const html=h.elements.get(id).innerHTML;
  check(fn+' counts three actual people, not six unrelated issues',()=>{assert.equal(h.live().length,1);assert.equal(h.live()[0].slot,'audience');assert.equal(h.live()[0].textContent,'3');});
  check(fn+' preserves all nine actual navigation slots',()=>assert.deepEqual([...html.matchAll(/data-slot="([^"]+)"/g)].map(m=>m[1]),['ol','issue','policy','office','army','map','finance','rumor','archive']));
  check(fn+' uses labels matching the actual drawer content',()=>{for(const label of ['阶层与党派','问对与朝议','钉选臣僚'])assert(html.includes(label));});
  check(fn+' clicks retain their original destinations',()=>{for(const m of html.matchAll(/onclick="([^"]+)"/g))vm.runInContext(m[1],h.c);assert.deepEqual(h.calls,['ol','issue','policy','office','army','map','finance','rumor','archive']);});
  check(fn+' does not read or mutate memorial/event/issue data for badges',()=>assert.equal(h.reads(),0));
  check(fn+' repeated refresh and world switch hide zero without stale counts',()=>{h.c.GM={turn:2,chars:[],_junqingBrief:[]};h.c.state.pinnedPeople=[];h.c[fn]();h.c.updateRailBadges();assert(h.live().every(b=>b.style.display==='none'&&b.textContent===''));});
}
check('legacy refresh hook cleans only obsolete right-rail badges, idempotently',()=>{
  const h=harness(),a=h.badge('tm-right-rail','ol','tm-rc-count'),b=h.badge('tm-phase8-formal-rail','issue','tmf-rail-count'),keep=h.badge('memorial-review','ol','real-pending');keep.textContent='12';
  h.c.updateRailBadges();h.c.updateRailBadges();assert(a.removed&&b.removed);assert.equal(keep.removed,false);assert.equal(keep.textContent,'12');assert.equal(h.reads(),0);
});
function query(h){assert.equal(typeof h.c.rightWenduiPendingState,'function','shared pending audience query required');return h.c.rightWenduiPendingState();}
check('shared query is read-only, without qid assignment or queue cleansing',()=>{const h=harness();h.c.GM._pendingAudiences.push({name:'旧使节',isEnvoy:true},null);const before=JSON.stringify(h.c.GM);assert.equal(query(h).count,4);query(h);assert.equal(JSON.stringify(h.c.GM),before);});
check('same person in queue and derived seekers counts once; multiple request records survive',()=>{const h=harness();h.c.GM._pendingAudiences.push({name:'甲',_qid:'a1'},{name:'甲',_qid:'a2'});const p=query(h);assert.equal(p.count,3);assert.equal(p.queue.length,4);assert.equal(p.seekers.length,0);assert.equal(h.c.GM._pendingAudiences.length,4);});
check('real agenda includes overdue commitment, not ordinary idle courtiers',()=>{const h=harness();h.c.GM._pendingAudiences=[];h.c.GM.chars[0].stress=0;assert.equal(query(h).count,0);h.c.GM._npcCommitments={乙:[{status:'delayed',assignedTurn:1,deadline:1,task:'核查'}]};h.c.GM.turn=4;assert.equal(query(h).count,1);});
check('dead, away, mourning and already-received derived seekers do not inflate count',()=>{const h=harness();h.c.GM._pendingAudiences=[];for(const fields of [{alive:false},{location:'远方'},{_mourning:true},{_lastMetTurn:2}]){Object.assign(h.c.GM.chars[0],{alive:true,location:'京师',_mourning:false,_lastMetTurn:0},fields);assert.equal(query(h).count,0);}});
check('original foreign/consort queue gates retained; real envoys and authored requests retained',()=>{const h=harness();h.c.GM.chars[0].stress=0;h.c.GM.chars.push({id:'foreign',name:'外君',foreign:true},{id:'other-consort',name:'他国后妃'},{id:'own-consort',name:'本朝后妃',playerConsort:true});h.c.GM._pendingAudiences=[null,{}, {name:'外君'},{name:'外君',isEnvoy:true},{name:'作者使者',_sid:'s'}, {name:'他国后妃',isConsort:true},{name:'本朝后妃',isConsort:true}];assert.deepEqual(Array.from(query(h).queue,q=>q.name),['外君','作者使者','本朝后妃']);});
check('badge routes pending audience to wendui even after prior chaoyi tab; no click acknowledgement',()=>{const h=harness();h.c.state.rightIssueTab='chaoyi';assert.equal(typeof h.c.openRailPanel,'function');const before=JSON.stringify(h.c.GM);h.c.openRailPanel('issue');assert.equal(h.c.state.rightIssueTab,'wendui');assert.equal(h.calls.at(-1),'issue');assert.equal(JSON.stringify(h.c.GM),before);});
check('zero pending preserves remembered chaoyi and other navigation choices',()=>{const h=harness();h.c.GM={chars:[],turn:2};h.c.state.rightIssueTab='chaoyi';assert.equal(typeof h.c.openRailPanel,'function');h.c.openRailPanel('issue');h.c.openRailPanel('army');assert.equal(h.c.state.rightIssueTab,'chaoyi');assert.deepEqual(h.calls,['issue','army']);});
check('actual stable-qid dismissal decrements count and preserves another request',()=>{const h=harness();h.c.ensurePreviewRail();h.c._wdDismissPending('envoy');assert.equal(query(h).count,2);assert.equal(h.c.GM._pendingAudiences[0]._qid,'b');assert.equal(h.live()[0].textContent,'2');});
check('actual refusal removes dynamic request for current turn without faking a meeting',()=>{const h=harness();h.c.ensurePreviewRail();h.c._wdDenyAudience('甲');assert.equal(query(h).count,2);assert.equal(h.live()[0].textContent,'2');assert.equal(h.c.GM.chars[0]._lastMetTurn,undefined);h.c.GM.turn++;assert.equal(query(h).count,3);});
check('missing queue and optional module hide badge safely',()=>{const h=harness();delete h.c.GM._pendingAudiences;assert.equal(query(h).count,1);delete h.c.TMPhase8FormalBridge.rightrail;h.c.ensurePreviewRail();assert(h.live().every(b=>b.style.display==='none'));});
check('actual memorial adapter keeps current pending and decided records intact',()=>{
  const g={turn:2,memorials:[{id:'a',status:'pending',turn:2},{id:'b',status:'approved',turn:2},{id:'c',status:'rejected',turn:2}]},c={window:{GM:g},firstArray:(...xs)=>xs.find(Array.isArray)||[],isPhase8FallbackMemorial:()=>false};
  vm.createContext(c);vm.runInContext(selectedFn(source,'getMemorials'),c);const before=JSON.stringify(g),rows=c.getMemorials();assert.equal(rows.length,3);assert.deepEqual(Array.from(rows,m=>m.status),['pending','approved','rejected']);assert.equal(JSON.stringify(g),before);
});
console.log(`[smoke-right-rail-badge-semantics] ${passed} PASS / ${failed} FAIL`);process.exitCode=failed?1:0;
