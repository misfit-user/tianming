#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../tm-battle-embed.js'),'utf8');let passed=0;
function check(c,m){assert(c,m);passed++;}
function setup(){
  const timers=new Map(),handlers=new Map(),posts=[];let next=1,iframe;
  function element(tag){const e={tag,style:{},children:[],events:{},setAttribute(){},appendChild(n){n.parent=this;this.children.push(n);},insertBefore(n,b){n.parent=this;this.children.splice(this.children.indexOf(b),0,n);},addEventListener(k,fn){this.events[k]=fn;},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}};if(tag==='iframe'){iframe=e;e.contentWindow={postMessage(d){posts.push(d);}};}return e;}
  const body=element('body'),c={console,Math,Date,Promise,setTimeout(fn,ms){const id=next++;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},document:{body,createElement:element,getElementById(id){return body.children.find(n=>n.id===id)||null;}}};
  c.window=c;c.addEventListener=(k,fn)=>handlers.set(k,fn);c.removeEventListener=k=>handlers.delete(k);vm.createContext(c);vm.runInContext(src,c);
  return{c,timers,posts,body,get iframe(){return iframe;},message(data,source=iframe.contentWindow){const fn=handlers.get('message');if(fn)fn({data,source});},fire(ms){const row=[...timers].find(([,t])=>t.ms===ms);if(row){timers.delete(row[0]);row[1].fn();}},handlers};
}
(async()=>{
  const a=setup(),p=a.c.TMBattleEmbed.launch({test:'config'});a.message({type:'battleReady'});check(a.posts.length===1,'Ready sends real config');
  const id=a.posts[0].sessionId;a.fire(500);check(a.posts.length===2&&a.posts[1].sessionId===id,'unacknowledged start retries same session');
  a.message({type:'battleStarted',sessionId:id},{not:'iframe'});check(a.timers.size===2,'foreign frame cannot acknowledge');
  a.message({type:'battleStarted',sessionId:'wrong'});check(a.timers.size===2,'wrong session cannot acknowledge');
  a.message({type:'battleStarted',sessionId:id});check(a.timers.size===0,'Ack cancels deadline and retry');
  a.message({type:'battleStarted',sessionId:id});a.message({type:'battleResult',sessionId:id,result:{outcome:'win',units:[]}});
  const r=await p;check(r.outcome==='win'&&a.body.children.length===0&&a.handlers.size===0,'result resolves once and removes overlay/listener');
  const b=setup(),q=b.c.TMBattleEmbed.launch({});b.fire(b.c.TMBattleEmbed.START_TIMEOUT);check((await q).code==='battle-start-timeout','no Ack has finite typed timeout');check(b.body.children.length===0&&b.timers.size===0,'timeout cleans all resources');
  const d=setup(),s=d.c.TMBattleEmbed.launch({});d.message({type:'battleError',error:'broken'});check((await s).code==='battle-runtime-error','startup error is error, not a fabricated battle result');
  const e=setup(),t=e.c.TMBattleEmbed.launch({});const bar=e.body.children[0].children.find(n=>n.children.some(x=>x.tag==='button'));bar.children[0].onclick();check((await t)===null&&e.timers.size===0,'manual abort before startup returns null and clears timers');
  const f=setup(),u=f.c.TMBattleEmbed.launch({});const duplicate=await f.c.TMBattleEmbed.launch({});check(duplicate.code==='battle-busy'&&f.body.children.length===1,'second launcher cannot stack battle overlays');f.message({type:'battleAborted'});await u;
  console.log('smoke-battle-embed-protocol: '+passed+' PASS');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
