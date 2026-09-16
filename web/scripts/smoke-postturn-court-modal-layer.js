'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
function fixture(){
  const nodes={},calls=[],layers=[],timers=[];
  const ctx={GM:{turn:1,busy:false},P:{},console,setTimeout:fn=>timers.push(fn),endTurn:function(){},_endTurnInternal:opts=>calls.push(opts),_tmPresentModal:(n,cancel)=>layers.push({node:n,cancel}),_tmCloseModalLayer:n=>n.remove()};
  ctx.document={getElementById:id=>nodes[id]||null,createElement:()=>({style:{},remove(){delete nodes[this.id]}}),body:{appendChild:n=>{nodes[n.id]=n}}};
  ctx._$=ctx.document.getElementById;ctx.window=ctx;
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../tm-court-meter.js'),'utf8'),ctx);
  return {ctx,nodes,calls,layers,timers};
}
let checks=0;const check=(v,m)=>{assert(v,m);checks++};
{
 const f=fixture();f.ctx.endTurn._preSubmitInFlight=true;f.ctx._showPostTurnCourtPromptAndStartEndTurn();
 check(f.layers.length===1,'court prompt enters shared modal layer');
 check(!/后台|次月|朔朝/.test(f.layers[0].node.innerHTML),'ten-day turns do not claim a new-moon court');
 f.ctx._showPostTurnCourtPromptAndStartEndTurn();check(f.layers.length===1,'duplicate pending prompt is not created');
 f.layers[0].cancel();check(!f.nodes['post-turn-court-prompt']&&!f.ctx.endTurn._preSubmitInFlight,'cancel closes only prompt and releases submission');
 check(f.calls.length===0,'cancel cannot submit a turn');
}
{
 const f=fixture();f.ctx._showPostTurnCourtPromptAndStartEndTurn();f.ctx._postTurnCourtChoose(false);
 check(f.calls.length===1&&f.calls[0].postTurnCourt===false,'declining court preserves ordinary submission path');
 check(!f.nodes['post-turn-court-prompt'],'selected prompt is removed through shared close');
}
{
 const f=fixture();f.ctx._showPostTurnCourtPromptAndStartEndTurn();f.ctx._postTurnCourtChoose(true);
 check(f.calls.length===1&&f.calls[0].postTurnCourt===true&&f.timers.length===1,'court choice preserves concurrent court path');
}
console.log('PASS postturn-court-modal-layer '+checks+' checks (no external AI calls)');
