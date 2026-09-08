#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(process.argv.includes('--repo')?process.argv[process.argv.indexOf('--repo')+1]:path.join(__dirname,'../..'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let pass=0;
function check(name,fn){fn();pass++;console.log('PASS',name);}
function harness(){
  const nodes=new Map(),children=[],timers=[];
  function node(tag){
    const classes=new Set();let html='';
    const n={tagName:tag.toUpperCase(),style:{},dataset:{},children:[],listeners:{},fields:[],
      classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle:k=>classes.has(k)?classes.delete(k):classes.add(k)},
      appendChild(el){this.children.push(el);el.parentNode=this;nodes.set(el.id,el);if(this===doc.body)children.push(el);return el;},
      addEventListener(type,fn){this.listeners[type]=fn;},remove(){nodes.delete(this.id);const i=children.indexOf(this);if(i>=0)children.splice(i,1);},
      querySelector(s){if(s==='.arc-modal')return this.modal;if(s==='.arc-body')return this.archive;if(s==='.ed-yuan')return this;return this.fields.find(f=>s==='#'+f.id)||null;},
      querySelectorAll(s){if(s==='[data-letter-draft-field]')return this.fields.filter(f=>f.dataset.letterDraftField);if(s==='[data-desk-memorial-reply]')return this.fields.filter(f=>f.replyId);return this.fields.filter(f=>f.id&&/^(edict-|xinglu)/.test(f.id));},
      get innerHTML(){return html;},set innerHTML(v){html=String(v);if(html.includes('arc-modal')){this.modal=node('div');this.archive=node('div');}},
      setAttribute(k,v){this[k]=String(v);},getAttribute(k){return this[k]||null;}};return n;
  }
  const doc={createElement:node,getElementById:id=>nodes.get(id)||null,querySelector:s=>s==='.tm-desk-overlay'?children.find(n=>n.className?.includes('tm-desk-overlay'))||null:null,
    querySelectorAll:s=>s==='.tm-desk-overlay'?children.filter(n=>n.className?.includes('tm-desk-overlay')):[],head:null,body:null};
  doc.head=node('head');doc.body=node('body');
  const c={console,document:doc,GM:{turn:4,sid:'fixture',_edictTracker:[],edicts:[],qijuHistory:[]},state:{},setTimeout:fn=>timers.push(fn),clearTimeout(){}};
  c.window=c;c.TM_PHASE8_FORMAL=c.state;vm.createContext(c);
  const bridgeSource=read('web/phase8-formal-bridge.js');
  vm.runInContext(['cloneDraftValue','formalDraftStore','clearFormalDraftRuntimeState','saveFormalDraftsToGM','restoreFormalDraftsFromGM','esc','attr','cssEscape'].map(n=>functionSource(bridgeSource,n)).join('\n'),c);
  let saves=0;
  c.TMPhase8FormalBridge={_state:c.state,_esc:c.esc,_attr:c.attr,_cssEscape:c.cssEscape,_getPeople:()=>[],_firstArray:(...a)=>a.find(Array.isArray)||[],
    _restoreFormalDraftsFromGM:c.restoreFormalDraftsFromGM,_saveFormalDraftsToGM(...a){saves++;return c.saveFormalDraftsToGM(...a);},_closeModule(){}};
  vm.runInContext(read('web/phase8-formal-drafts.js'),c,{filename:'phase8-formal-drafts.js'});
  const api=c.TMPhase8FormalBridge.drafts;
  return {c,doc,api,timers,open(){c.openZhao();return doc.querySelector('.tm-desk-overlay');},saves:()=>saves,reset:()=>{saves=0;},
    field(id,value,attributes={}){return {id,value,dataset:attributes.dataset||{},getAttribute:k=>attributes[k]||null,hasAttribute:k=>Object.hasOwn(attributes,k),replyId:attributes['data-memorial-reply-id']};}};
}
const h=harness();let reads=0;
h.c.GM._edictTracker=[{id:'a',turn:1,category:'政令',get content(){reads++;return '<img onerror="x">组合 e\u0301 😀';},status:'completed',feedback:'已收讫',assignee:'甲'},
  {id:'b',turn:2,category:'军令',content:'完整第二道',status:'executing'},{id:'future',turn:4,content:'不属于旧诏'}];
let ov=h.open();
check('opening edict does not build hidden archive content',()=>assert.equal(reads,0));
check('same historical count is displayed without historical DOM',()=>{assert(ov.innerHTML.includes('历史诏书<span class="n">2</span>'));assert(!ov.innerHTML.includes('完整第二道'));});
function archiveClick(root){const button={closest:s=>s==='[data-desk-edict-archive]'?button:null};root.listeners.click({target:button});}
archiveClick(ov);
check('explicit archive action builds complete sorted escaped text',()=>{assert.equal(reads,1);assert(ov.modal.classList.contains('show'));const s=ov.archive.innerHTML;assert(s.indexOf('完整第二道')<s.indexOf('&lt;img'));assert(s.includes('已收讫')&&s.includes('组合 e\u0301 😀'));assert(!s.includes('不属于旧诏'));});
h.c.GM._edictTracker[1].content='就地修改回执';ov.archive.scrollTop=42;archiveClick(ov);
check('reopening archive sees in-place changes and retains scroll',()=>{assert(ov.archive.innerHTML.includes('就地修改回执'));assert.equal(ov.archive.scrollTop,42);});
const ids=['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth','xinglu-pub'];
ov.fields=ids.map((id,i)=>h.field(id,' 草稿 '+i+' e\u0301 😀 '));h.reset();h.api.closeDeskOverlay();
check('close captures six fields with one aggregate persistence',()=>assert.equal(h.saves(),1));
check('draft whitespace and aliases retained',()=>{const d=h.c.GM._phase8FormalDrafts;assert.equal(d.edictDrafts.policy,' 草稿 0 e\u0301 😀 ');assert.equal(d.edictDrafts.economic,d.edictDrafts.finance);assert.equal(d.playerAction,' 草稿 5 e\u0301 😀 ');});
ov=h.open();check('reopen restores all draft values',()=>ids.slice(0,5).forEach((id,i)=>assert(ov.innerHTML.includes(' 草稿 '+i+' e\u0301 😀 '))));
h.reset();h.api.closeDeskOverlay();h.api.closeDeskOverlay();check('repeated close is a no-op once detached',()=>assert.equal(h.saves(),1));
ov=h.open();ov.fields=[h.field('letter-body','保留信札',{dataset:{letterDraftField:'body'}}),h.field('reply','保留朱批',{'data-memorial-reply-id':'memo-1'})];h.reset();h.api.captureDeskOverlayState(ov);
check('letter and memorial capture share one save without dropping values',()=>{assert.equal(h.saves(),1);assert.equal(h.c.GM._phase8FormalDrafts.letterDraft.body,'保留信札');assert.equal(h.c.GM._phase8FormalDrafts.memorialReplies['memo-1'],'保留朱批');});
const field=h.field('edict-pol','新输入');ov.fields=[field];h.reset();ov.listeners.input({target:{closest:selector=>selector.includes('#edict-pol')?field:null}});
check('ordinary input still persists immediately',()=>{assert.equal(h.saves(),1);assert.equal(h.c.GM._phase8FormalDrafts.edictDrafts.policy,'新输入');});
const bad=h.field('edict-pol','');Object.defineProperty(bad,'value',{get(){throw Error('injected getter');}});ov.fields=[bad];
check('capture exception is not swallowed',()=>assert.throws(()=>h.api.captureDeskOverlayState(ov),/injected getter/));
ov.fields=[field];h.reset();h.api.captureDeskOverlayState(ov);check('exception restores capture depth for next operation',()=>assert.equal(h.saves(),1));
const live=JSON.stringify(h.c.GM),target=JSON.parse(live);h.c.saveFormalDraftsToGM(true,target);
check('detached snapshot capture preserves live store',()=>{assert.equal(JSON.stringify(h.c.GM),live);assert.equal(target._phase8FormalDrafts.edictDrafts.policy,'新输入');});
const a=h.c.GM;h.c.GM={turn:1,sid:'other',_edictTracker:[],edicts:[],qijuHistory:[]};
const oldArchive=ov.archive.innerHTML;archiveClick(ov);check('stale overlay cannot build archive for a different world',()=>assert.equal(ov.archive.innerHTML,oldArchive));
h.c.GM=a;h.api.closeDeskOverlay();h.c.GM={turn:1,sid:'other',_edictTracker:[],edicts:[],qijuHistory:[]};h.c.restoreFormalDraftsFromGM(true);ov=h.open();archiveClick(ov);
check('new world empty archive and drafts are not inherited',()=>{assert(ov.archive.innerHTML.includes('尚无往期诏令'));assert(!ov.innerHTML.includes('新输入'));});
console.log('[smoke-perf-desk-panels]',pass,'PASS');
