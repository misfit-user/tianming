'use strict';
const {fixture}=require('./lib-npc-action-fixture');
function politicalFixture(options={}){
  const c=fixture(options);
  c.GM.facs=[{id:'fa',name:'甲国',treasury:{money:100,grain:80,cloth:20},officeTree:[]},{id:'fb',name:'乙国',treasury:{money:70,grain:40,cloth:10},officeTree:[]}];
  c.P.conf={factionAgentEnabled:true,factionLlmDecisionEnabled:true};
  c.a=c.actor('a','甲代表',{factionId:'fa',faction:'甲国',officialTitle:'甲使'});
  c.b=c.actor('b','乙代表',{factionId:'fb',faction:'乙国',officialTitle:'乙使'});
  c.liaison=c.actor('l','联络人',{factionId:'fa',faction:'甲国'});
  c.subject=c.actor('s','候选者',{factionId:'fb',faction:'乙国'});
  c.fa=c.GM.facs[0];c.fb=c.GM.facs[1];
  c.fa.officeTree=[{id:'da',name:'甲署',positions:[{id:'pa',name:'甲使',holderId:'a',holder:'甲代表',powers:{appointment:true,diplomacy:true,treatySign:true,treasurySpend:true}},{id:'va',name:'甲缺',actualHolders:[],headCount:1}]}];
  c.fb.officeTree=[{id:'db',name:'乙署',positions:[{id:'pb',name:'乙使',holderId:'b',holder:'乙代表',powers:{appointment:true,diplomacy:true,treatySign:true,treasurySpend:true}},{id:'vb',name:'乙缺',actualHolders:[],headCount:1}]}];
  c.GM._facIndex={'甲国':{chars:[c.a,c.liaison]},'乙国':{chars:[c.b,c.subject]}};
  ['tm-political-actions.js','tm-feudal-warfare.js','tm-faction-action-engine.js','tm-faction-diplomacy.js','tm-faction-npc-guoku.js'].forEach(c.load);
  return c;
}
module.exports={politicalFixture};
