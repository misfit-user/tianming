import {edit} from './patch-utils.mjs';
edit('web/tm-endturn-render.js',(s,r)=>{
  s=r(s,"  var checksum = await _endTurn_stateChecksum(snapshot, canonicalPayload);",`  var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;
  if (!reliability || typeof reliability.callTurnBridge !== 'function') throw new Error('桌面分卷等待管理未加载');
  var stageGM = GM, stageP = P, stageTurn = GM.turn, stageName = GM.saveName, stageGen = window._tmLoadGen || 0;
  var stageCampaign = String(GM._campaignId || ''), stageTimeline = String(GM._timelineId || '');
  function stageLeaseCurrent() { return GM === stageGM && P === stageP && GM.turn === stageTurn && GM.saveName === stageName && (window._tmLoadGen || 0) === stageGen && String(GM._campaignId || '') === stageCampaign && String(GM._timelineId || '') === stageTimeline; }
  var checksum = await _endTurn_stateChecksum(snapshot, canonicalPayload);
  if (!stageLeaseCurrent()) throw new Error('分卷校验期间世界已改变，未发送旧数据');`);
  s=r(s,'  var result = await window.tianming.stageTurnData(Object.assign({ data: presentation.turnData }, marker));',"  var result = await reliability.callTurnBridge('stageTurnData', Object.assign({ data: presentation.turnData }, marker), { isCurrent: stageLeaseCurrent });");
  s=r(s,"  var result = await window.tianming.publishTurnData(marker);", "  var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;\n  if (!reliability || typeof reliability.callTurnBridge !== 'function') throw new Error('桌面分卷等待管理未加载');\n  var result = await reliability.callTurnBridge('publishTurnData', marker, { isCurrent: publishLeaseCurrent });");
  s=r(s,'  ctx.meta.stagedTurnData = null;\n  return true;\n}\n\n// 回合存档唯一入口', "  if (!publishLeaseCurrent()) throw new Error('回合分卷清理结束时世界身份已变化');\n  ctx.meta.stagedTurnData = null;\n  return true;\n}\n\n// 回合存档唯一入口");
  const start=s.indexOf('async function _endTurn_discardStagedTurnData('),end=s.indexOf('async function _endTurn_publishStagedTurnData(',start);
  if(start<0||end<0)throw Error('Discard boundary unavailable');
  return r(s,s.slice(start,end),`async function _endTurn_discardStagedTurnData(ctx) {
  var marker = ctx && ctx.meta && ctx.meta.stagedTurnData;
  if (!marker) return true;
  var receipt = ctx.meta.canonicalSaveReceipt || (ctx.meta.transaction && ctx.meta.transaction.canonicalSaveReceipt);
  if (receipt && receipt.state === 'committed') throw new Error('主存档已提交，禁止丢弃待发布分卷');
  var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;
  if (!reliability || typeof reliability.callTurnBridge !== 'function') throw new Error('桌面分卷等待管理未加载');
  var gm = GM, p = P, generation = window._tmLoadGen || 0;
  function current() { return GM === gm && P === p && (window._tmLoadGen || 0) === generation && ctx.meta.stagedTurnData === marker; }
  var result = await reliability.callTurnBridge('discardTurnData', marker, { isCurrent: current });
  if (!result || result.success !== true) throw new Error('分卷丢弃未确认，保留原有恢复信息');
  if (typeof TM_SaveDB !== 'undefined' && TM_SaveDB && typeof TM_SaveDB.deleteTurnPublishReceipt === 'function') {
    if (await TM_SaveDB.deleteTurnPublishReceipt(marker, { writeGuard: current }) !== true) throw new Error('分卷已丢弃但回执清理失败');
  }
  if (!current()) throw new Error('丢弃分卷期间世界已改变');
  ctx.meta.stagedTurnData = null;
  return true;
}

`);
});
