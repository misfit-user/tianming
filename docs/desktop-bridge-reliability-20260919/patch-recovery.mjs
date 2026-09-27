import {edit} from './patch-utils.mjs';
edit('web/tm-save-lifecycle.js',(s,r)=>{
  const start=s.indexOf('function _recoverPendingTurnDataPublish('),end=s.indexOf('function _tmCaptureLoadTransaction(',start);
  let fn=s.slice(start,end);
  fn=r(fn,"    if (window.tianming.turnDataProtocolVersion !== 2) throw new Error('分卷恢复需要更新桌面安装包');", "    if (window.tianming.turnDataProtocolVersion !== 2) throw new Error('分卷恢复需要更新桌面安装包');\n    var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;\n    if (!reliability || typeof reliability.callTurnBridge !== 'function') throw new Error('桌面分卷等待管理未加载');");
  fn=r(fn,'var legacyResult = await window.tianming.recoverTurnData(legacyMarker);',"var legacyResult = await reliability.callTurnBridge('recoverTurnData', legacyMarker, { isCurrent: legacyLeaseCurrent });");
  fn=r(fn,'var result = await window.tianming.recoverTurnData(marker);',"var result = await reliability.callTurnBridge('recoverTurnData', marker, { isCurrent: baseRecoveryLeaseCurrent });");
  fn=r(fn,"if (!marker || String(marker.timelineId || '') !== timelineId", "if (!marker || String(marker.campaignId || '') !== campaignId || String(marker.timelineId || '') !== timelineId");
  return r(s,s.slice(start,end),fn);
});
edit('web/tm-storage.js',(s,r)=>r(s,
  '    return Promise.resolve(bridge.listSaveTimelineRefs()).then(function(result) {',
  "    var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;\n    if (!reliability || typeof reliability.callTurnBridge !== 'function') return Promise.resolve(true);\n    return reliability.callTurnBridge('listSaveTimelineRefs', null).then(function(result) {"));
