'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{fixture}=require('./lib-npc-action-fixture');
const c=fixture(),el={innerHTML:''};c._$=id=>id==='office-tree'?el:null;c.load('tm-office-runtime.js');
c.P.officeTree=[{id:'old',name:'旧衙',positions:[{id:'old-seat',name:'旧官',holder:'甲',holderId:'a'}]}];c.actor('a','甲',{officialTitle:'旧官'});
c.GM.officeTree=[];c.renderOfficeTree(true);assert.equal(c.GM.officeTree.length,0);assert(el.innerHTML.includes('未配置'));
c.GM.officeTree=[{id:'current',name:'本署',positions:[{id:'seat',name:'旧官',holder:'',actualHolders:[],headCount:1}]}];
const before=JSON.stringify(c.GM.officeTree);c._offSyncHoldersFromChars({readOnly:true,force:true});assert.equal(JSON.stringify(c.GM.officeTree),before,'read-only overrides force and never infers appointments from a title');
const seats=JSON.stringify(c.GM.officeTree[0].positions),people=JSON.stringify(c.GM.chars),money=JSON.stringify(c.GM.guoku);
c.renderOfficeDeptV2=(dept)=>'<section>'+dept.name+'</section>';c.renderOfficeTree(true);assert.equal(JSON.stringify(c.GM.officeTree[0].positions),seats);assert.equal(JSON.stringify(c.GM.chars),people);assert.equal(JSON.stringify(c.GM.guoku),money);assert(el.innerHTML.includes('本署'));
// Explicit import/synchronization remains available to the existing load/settlement paths.
c._offSyncHoldersFromChars({force:true,importSeats:true});assert(c.GM.officeTree.some(d=>(d.positions||[]).some(p=>p.holder==='甲')));
const rail=fs.readFileSync(path.resolve(__dirname,'../phase8-formal-rightrail.js'),'utf8');assert(rail.includes('_offSyncHoldersFromChars({readOnly:true})'));
console.log('[smoke-office-tree-render-rederive] PASS real render is read-only; explicit load/import synchronization remains functional');
