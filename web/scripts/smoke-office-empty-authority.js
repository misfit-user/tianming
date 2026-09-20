'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,TM:{NativeWorld:{enabled:()=>true,allowed:()=>false},OfficeCreation:{isCreation:()=>true,prepare:()=>{throw Error('Unauthorized creation must not be planned');}}}};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../tm-office-reform.js'),'utf8'),c);
for(const state of [{startContext:{playerFactionId:'player'}},{officeTree:null,startContext:{playerFactionId:'player'}},{officeTree:[],startContext:{playerFactionId:'player'}}])for(const preview of [false,true]){
 const before=JSON.stringify(state),r=c.applyReformToTree(state,{reformDetail:'增设',dept:'测试院'},{preview});
 assert.equal(r.applied,false);assert.equal(r.code,'native-reform-authority-denied');assert.equal(JSON.stringify(state),before);
}
console.log('PASS office empty-tree authority: denied creation and preview leave all six full input states byte-equivalent');
