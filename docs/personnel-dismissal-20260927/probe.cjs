'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../..');
function fixture(options={}) {
 const c={console:{log(){},warn(){},error(){}},Date,Math,JSON,Object,Array,Set,Map,WeakMap,Promise,Number,String,Boolean,RegExp,isFinite,parseInt,parseFloat,setTimeout(){},clearTimeout(){},getTSText:()=>'',addEB(){}};
 c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-office-system.js','tm-start-contracts.js','tm-start-world.js','tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js'])vm.runInContext(fs.readFileSync(path.join(root,'web',f),'utf8'),c,{filename:f});
 c.GM={turn:2,chars:[{id:'cui',name:'崔呈秀',alive:true,officialTitle:'兵部尚书',title:'兵部尚书',position:'兵部尚书',faction:'明朝廷'}],facs:[],armies:[],guoku:{money:1000},neitang:{money:0},_turnReport:[],officeTree:[{name:'兵部',positions:[{id:'war-minister',name:'兵部尚书',holder:'崔呈秀',holderId:'cui',establishedCount:1,headCount:1,actualCount:1,vacancyCount:0,actualHolders:[{characterId:'cui',name:'崔呈秀',generated:true}]}]}]};
 c.P={playerInfo:{factionName:'明朝廷'}};
 if(options.idOnly)delete c.GM.officeTree[0].positions[0].actualHolders[0].name;
 if(options.children)c.GM.officeTree=[{name:'六部',children:c.GM.officeTree}];
 c.GM._currentEdicts={political:'将崔呈秀革职抄家，拘押候勘。'};
 return c;
}
function snapshot(c){return {chars:c.GM.chars.map(x=>({id:x.id,title:x.officialTitle,imprisoned:x._imprisoned})),officeTree:c.GM.officeTree};}
if(require.main===module){
 for(const [label,options,change,former] of [
 ['exact-screen',{},'革职抄家·拘押候勘','兵部尚书'],['simple',{},'革职',''],['simple-former',{},'革职','兵部尚书'],['id-only',{idOnly:true},'革职抄家·拘押候勘','兵部尚书'],['children',{children:true},'革职抄家·拘押候勘','兵部尚书']]){
  const c=fixture(options),p={edicts:{political:'将崔呈秀革职抄家，拘押候勘。'},personnel_changes:[{name:'崔呈秀',former,change,reason:'奉旨查办'}]};
  const result=c.applyAITurnChanges(p);console.log(JSON.stringify({label,result,after:snapshot(c),pc:p.personnel_changes}));
 }
}
module.exports={fixture,snapshot};
