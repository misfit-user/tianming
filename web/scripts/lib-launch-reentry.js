'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
function fixture(desktop=true) {
 let doc;
 class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.className='';this.events={};this.attrs={};this.parentNode=null;this._html='';this._text='';
   this.classList={contains:n=>this.className.split(/\s+/).includes(n),add:(...ns)=>{this.className=[...new Set(this.className.split(/\s+/).filter(Boolean).concat(ns))].join(' ');},remove:(...ns)=>{this.className=this.className.split(/\s+/).filter(n=>n&&!ns.includes(n)).join(' ');}};}
  appendChild(el){el.remove();el.parentNode=this;this.children.push(el);return el;}
  remove(){if(this.parentNode){const a=this.parentNode.children;a.splice(a.indexOf(this),1);this.parentNode=null;}}
  replaceChildren(...nodes){this.children.slice().forEach(n=>n.remove());nodes.forEach(n=>this.appendChild(n));this._html='';this._text='';}
  get parentElement(){return this.parentNode;} get firstElementChild(){return this.children[0]||null;}
  get isConnected(){let n=this;while(n){if(n===doc.body)return true;n=n.parentNode;}return false;}
  set innerHTML(v){this.replaceChildren();this._html=String(v);}get innerHTML(){return this._html;}
  set textContent(v){this.replaceChildren();this._text=String(v);}get textContent(){return this._text+this._html+this.children.map(n=>n.textContent).join('');}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=String(v);}getAttribute(k){return k==='id'?this.id:this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}removeEventListener(k,fn){this.events[k]=(this.events[k]||[]).filter(f=>f!==fn);}
  click(){for(const fn of this.events.click||[])fn({target:this});if(this.onclick)this.onclick({target:this});}
  querySelectorAll(selector){let result=[];function walk(node){for(const el of node.children){if(selector.split(',').some(s=>matches(el,s.trim())))result.push(el);walk(el);}}walk(this);return result;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
 }
 function matches(el,s){if(s.startsWith('#'))return el.id===s.slice(1);if(s.startsWith('.'))return s.slice(1).split('.').every(n=>el.classList.contains(n));return el.tagName.toLowerCase()===s;}
 const body=new Element('body');
 doc={body,createElement:t=>new Element(t),createTextNode:t=>{const n=new Element('text');n.textContent=t;return n;},getElementById:id=>body.id===id?body:body.querySelector('#'+id),querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),events:{},addEventListener(k,f){(this.events[k]??=[]).push(f);},removeEventListener(k,f){this.events[k]=(this.events[k]||[]).filter(x=>x!==f);}};
 function node(id,parent=body,display='none'){const el=new Element('div');el.id=id;el.style.display=display;parent.appendChild(el);return el;}
 const launch=node('launch',body,'flex'),hero=node('hero',launch,'');hero.className='home-stage';node('main-view',launch);
 for(const id of ['scn-page','G','E','bar','bar-btns','pause-bg','settings-bg','turn-modal','loading','shiji-btn','save-btn','ppop'])node(id);
 doc.getElementById('scn-page').className='scn-page';
 const calls={starts:[],saved:0,settings:0},hooks={};
 const c={document:doc,console:{log(){},warn(){},error(){}},Promise,Date,Math,JSON,Array,Object,Number,Set,Map,setTimeout,clearTimeout,
  P:{scenarios:[{id:'one',name:'完整剧本',era:'测试',role:'玩家',background:'完整背景',worldSettings:{}}],conf:{},_indices:{scenarioById:{}}},GM:{running:false,turn:3,sid:'one'},
  TM:{pauseFab:{refresh(){}},errors:{capture(){}}},_$:id=>doc.getElementById(id),_dbg(){},toast(){},confirm:()=>true,
  escHtml:s=>String(s||''),tmIcon:()=>'',findScenarioById:id=>c.P.scenarios.find(s=>s.id===id),buildIndices(){},getTSText:()=> '本月',saveP(){calls.saved++;},
  startGame(id){calls.starts.push(id);c.GM.running=true;doc.getElementById('launch').style.display='none';doc.getElementById('G').style.display='grid';},
  GameHooks:{on(k,f){(hooks[k]??=[]).push(f);},run(k){for(const f of hooks[k]||[])f();}},
  getComputedStyle:el=>({display:el.style.display==='none'?'none':el.classList.contains('show')?'flex':el.style.display||'block'})};
 if(desktop)c.tianming={isDesktop:true,listScenarios:async()=>({success:true,files:[]})};
 c.window=c;c.globalThis=c;vm.createContext(c);
 vm.runInContext(require('./lib-perf-round1').functionSource(read('tm-patches-start.js'),'_tmCancelPendingStartRequest'),c);
 vm.runInContext(read('tm-launch.js'),c,{filename:'tm-launch.js'});
 if(desktop)vm.runInContext(read('tm-electron.js'),c,{filename:'tm-electron.js'});
 const player=read('tm-player-core.js'),start=player.indexOf('function _tmPlayerGameSurfaceActive'),end=player.indexOf('// N8:');
 vm.runInContext(player.slice(start,end),c,{filename:'tm-player-core.js:keyboard'});
 c.openSettings=()=>{calls.settings++;doc.getElementById('settings-bg').classList.add('show');};c.closeSettings=()=>doc.getElementById('settings-bg').classList.remove('show');
 function key(key){const e={key,preventDefault(){},target:doc.body};for(const fn of doc.events.keydown||[])fn(e);}
 return{c,doc,node,calls,key,hero,Element};
}
module.exports={fixture,read};
