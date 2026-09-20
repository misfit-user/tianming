'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {ROOT,clone,loadFunctions,renderFixture,tick}=require('./lib-save-commit-boundary');
const watch=promise=>Promise.resolve(promise).then(value=>({value}),error=>({error}));
function fixture(root=ROOT){
  const f=renderFixture(root),c=f.c,timers=new Map(),calls=[];let seq=0;
  c.setTimeout=(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;};c.clearTimeout=id=>timers.delete(id);
  c.GM.saveName='合成测试档';c.deepClone=clone;c.toast=message=>f.events.push('toast');
  c.tianming={isDesktop:true,turnDataProtocolVersion:2};
  for(const method of ['stageTurnData','publishTurnData','recoverTurnData','discardTurnData'])c.tianming[method]=async payload=>{calls.push({method,payload:clone(payload)});return {success:true,transactionId:payload.transactionId};};
  c.tianming.listSaveTimelineRefs=async()=>({success:true,complete:true,refs:[]});
  const receipts=[];
  c.TM_SaveDB.deleteTurnPublishReceipt=async(marker,opts)=>{if(opts&&opts.writeGuard&&!opts.writeGuard())return false;const at=receipts.findIndex(r=>r.transactionId===marker.transactionId);if(at>=0)receipts.splice(at,1);f.events.push('delete-receipt');return true;};
  c.TM_SaveDB.listTurnPublishReceipts=async()=>receipts.slice();
  c.TM_SaveDB.clearPendingTurnDataPublishAtomic=async()=>{f.events.push('legacy-clear');return true;};
  c.TM.errors={capture(){}};
  vm.runInContext(fs.readFileSync(path.join(root,'tm-endturn-reliability.js'),'utf8'),c,{filename:'tm-endturn-reliability.js'});
  loadFunctions(c,'tm-endturn-render.js',['_endTurn_stateChecksum','_endTurn_stageTurnData','_endTurn_discardStagedTurnData','_endTurn_publishStagedTurnData'],root);
  loadFunctions(c,'tm-save-lifecycle.js',['_recoverPendingTurnDataPublish'],root);
  loadFunctions(c,'tm-storage.js',['_desktopTimelineMayBeReferenced'],root);
  f.ctx.meta.turnPresentation={turnData:{context:{text:'完整上下文与世界事实。'.repeat(20)},playerInput:{edicts:['完整诏令']},aiResults:{sc1:{decision:'完整结算'},zhengwen:'完整正文。'.repeat(30)},varChanges:{gold:-7}}};
  function marker(){return {protocolVersion:2,saveName:c.GM.saveName,turn:3,campaignId:c.GM._campaignId,timelineId:c.GM._timelineId,transactionId:f.txn.transactionId,stateChecksum:'fixture'};}
  function fire(){let n=0;for(const [id,timer]of [...timers]){if(timer.ms===60000){timers.delete(id);timer.fn();n++;}}return n;}
  return {...f,c,timers,calls,receipts,marker,fire,api:c.TM.Endturn.Reliability};
}
module.exports={fixture,watch,tick,clone,loadFunctions,ROOT};
