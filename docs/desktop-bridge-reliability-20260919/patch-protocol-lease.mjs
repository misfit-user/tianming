import {edit} from './patch-utils.mjs';
edit('web/tm-endturn-reliability.js',(s,r)=>r(s,'      var key, expected = {};',"      if (method !== 'listSaveTimelineRefs' && bridge.turnDataProtocolVersion !== 2) { reject(bridgeError('TURN_BRIDGE_PROTOCOL', '分卷时间线协议不匹配，未发送桌面操作', false)); return; }\n      var key, expected = {};"));
edit('web/tm-endturn-render.js',(s,r)=>{
  s=r(s,'var stageGM = GM, stageP = P, stageTurn = GM.turn,','var stageBridge = window.tianming, stageGM = GM, stageP = P, stageTurn = GM.turn,');
  return r(s,'function stageLeaseCurrent() { return GM === stageGM','function stageLeaseCurrent() { return window.tianming === stageBridge && GM === stageGM');
});
edit('web/tm-save-lifecycle.js',(s,r)=>{
  const start=s.indexOf('function _recoverPendingTurnDataPublish('),end=s.indexOf('function _tmCaptureLoadTransaction(',start);let fn=s.slice(start,end);
  fn=r(fn,'  var targetGM = GM;','  var recoveryBridge = window.tianming;\n  var targetGM = GM;');
  fn=r(fn,'    return GM === targetGM && P === targetP &&','    return window.tianming === recoveryBridge && GM === targetGM && P === targetP &&');
  return r(s,s.slice(start,end),fn);
});
edit('web/scripts/smoke-desktop-bridge-reliability.js',(s,r)=>r(s,'(async()=>{',`test('protocol changes and a replaced bridge during checksum never send stale stage data',async()=>{
  const f=fixture();f.c.tianming.turnDataProtocolVersion=1;
  assert.equal((await watch(f.api.callTurnBridge('stageTurnData',f.marker()))).error.code,'TURN_BRIDGE_PROTOCOL');assert.equal(f.calls.length,0);
  f.c.tianming.turnDataProtocolVersion=2;f.c._endTurn_stateChecksum=async()=>{f.c.tianming={...f.c.tianming};return 'fixture';};
  assert((await watch(f.c._endTurn_stageTurnData(f.ctx,{}))).error);assert.equal(f.calls.length,0);
});
(async()=>{`));
