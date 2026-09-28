'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../..'),scripts=path.join(root,'web/scripts'),file=path.join(scripts,'smoke-start-game-data-integrity.js');
const src=fs.readFileSync(file,'utf8').replace(/^#![^\n]*\n/,''),end=src.indexOf('(async function main()');assert(end>0);
const helper=new Function('require','process','__dirname','__filename','module','exports',src.slice(0,end)+'\nreturn {loadGame,dispose:()=>disposeGame()};')(createRequire(file),process,scripts,file,{exports:{}},{});
const c=helper.loadGame(null),sc=JSON.parse(fs.readFileSync(path.join(root,'scenarios/天启七年·九月（官方）.json'),'utf8'));
c.__source=sc;vm.runInContext("P.scenarios=P.scenarios.filter(s=>s.id!==__source.id);P.scenarios.push(__source);P.ai.key='';P.ai.url='';P.ai.model='';doActualStart(__source.id);",c,{timeout:60000});
setTimeout(()=>{try{
 const text='令百官奏事时均注明承办人及日期，以便逐项检核，不得虚报。';
 c.GM.edicts=[{id:'native-published-audit',turn:c.GM.turn,text,status:'promulgated',source:'polish'}];
 for(const id of ['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth']){const el=c.document.getElementById(id);if(el)el.value='';}
 if(c.TMPhase8FormalBridge?.clearEdictDrafts)c.TMPhase8FormalBridge.clearEdictDrafts();
 const before=c.GM._edictTracker?.length||0,input=c._endTurn_collectInput(),matched=(c.GM._edictTracker||[]).filter(e=>e&&e.content&&e.content.includes('逐项检核'));
 assert.equal(input.edicts.decree,text,'whole decree survives complete collection');assert.equal(matched.length,0,'reproduced missing registration after full mechanical preparation');
 const out={scope:'Actual official startup and complete production _endTurn_collectInput, synthetic published record, no real model or player save',sid:c.GM.sid,turn:c.GM.turn,edicts:input.edicts,trackerCountBefore:before,trackerCountAfter:c.GM._edictTracker?.length||0,matchingTrackers:matched,classification:c.GM._lastEdictClassification?.classification||null};
 fs.writeFileSync(path.join(__dirname,'native-collection-results.json'),JSON.stringify(out,null,2));console.log('[native-collection] PASS '+JSON.stringify({turn:out.turn,fullTextRetained:true,matchingTrackers:matched.length,before,after:out.trackerCountAfter}));helper.dispose();process.exit(0);
}catch(e){console.error(e.stack);helper.dispose();process.exit(1);}},200);
