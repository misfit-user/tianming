/* Actor-scoped personal recall shared by game and editor; read-only. */
(function(root){'use strict';var TM=root.TM=root.TM||{},arr=x=>Array.isArray(x)?x:[],indexes=new WeakMap();
function txt(x){return typeof x==='string'?x:x==null?'':String(x);}
function memoryIndex(g){
 var archive=arr(g._memoryArchiveFull),old=indexes.get(g);
 if(!old||old.archive!==archive||archive.length<old.length||old.loadGen!==(root._tmLoadGen||0)){old={archive:archive,length:0,loadGen:root._tmLoadGen||0,byActor:new Map()};indexes.set(g,old);}
 for(var i=old.length;i<archive.length;i++){
  var m=archive[i];if(!m)continue;var actor=m.actorId||m.char;if(!actor)continue;
  if(!old.byActor.has(actor))old.byActor.set(actor,[]);old.byActor.get(actor).push(m);
 }old.length=archive.length;return old;
}
function tokens(query){
 var text=txt(query).slice(-4000),out=new Set(text.match(/[A-Za-z0-9_-]{3,}/g)||[]);
 for(var word of text.match(/[\u3400-\u9fff]{2,}/g)||[])for(var i=0;i<word.length-1;i++)out.add(word.slice(i,i+2));
 return Array.from(out).slice(-100);
}
function recall(g,ch,query,limit){
 if(!g||!ch)return [];var ix=memoryIndex(g),candidates=[],seen=new Set();
 [ix.byActor.get(ch.id),ix.byActor.get(ch.name),ch._memory].forEach(a=>arr(a).forEach(m=>{
  if(!m||!m.event)return;var sig=txt(m.turn)+'|'+m.event;if(seen.has(sig))return;seen.add(sig);candidates.push(m);
 }));
 var ts=tokens(query),freq=new Map();ts.forEach(t=>freq.set(t,candidates.reduce((n,m)=>n+Number(m.event.includes(t)),0)));
 if(typeof root._tmFilterMemories==='function')candidates=root._tmFilterMemories(candidates,g);
 return candidates.map(m=>{
  var relevance=ts.reduce((n,t)=>n+(m.event.includes(t)?1/Math.max(1,freq.get(t)):0),0);
  return {memory:m,score:relevance*1000+(Number(m.importance)||0)+Math.min(2,(Number(m.turn)||0)/Math.max(1,Number(g.turn)||1)),relevance:relevance};
 }).filter(x=>!ts.length||x.relevance>0).sort((a,b)=>b.score-a.score||(b.memory.turn||0)-(a.memory.turn||0)).slice(0,limit||6).map(x=>x.memory);
}
function personal(g,ch,query,limit){
 return recall(g,ch,query,limit).map(m=>{
  var certainty=m.factStatus==='unverified_claim'||m.source==='reported'||m.source==='rumor'?'当时听闻或自述，未经核验':m.factStatus==='verified'?'当时已核验':'个人历史记录';
  var e=txt(m.event),snippet=e.length>700?e.slice(0,330)+'…（摘录）…'+e.slice(-330):e;
  return '['+(m.id||'NPC-memory:'+ch.id+':'+m.turn)+'] T'+(m.turn??'?')+' '+certainty+'：'+snippet;
 }).join('\n');
}
TM.PersonalMemoryRecall={personal:personal,recall:recall,tokens:tokens};
})(typeof window!=='undefined'?window:globalThis);
