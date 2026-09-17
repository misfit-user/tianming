// Excerpts from the pinned commit. Dependencies supplied by the isolated harness.
// web/tm-save-lifecycle.js, window.desktopDoSave.
window.desktopDoSave=async function(){
  await _tmAwaitLoadBarrier();
  var name=(_$("save-name-inp").value||"").trim();
  if(!name){toast("\u8BF7\u8F93\u5165\u5B58\u6863\u540D");return;}
  var sc=findScenarioById(GM.sid);
  if (typeof _awaitPostTurnJobsForSave === 'function') await _awaitPostTurnJobsForSave();
  var saveData=_buildSaveState({format:'project'});
  saveData._saveMeta={name:name,turn:GM.turn,time:getTSText(GM.turn),scenario:sc?sc.name:"",date:new Date().toISOString(),version:P.meta.v};
  try{
    var r=await window.tianming.saveProject(name,saveData);
    if(r.success){GM.saveName=name;toast("\u2705 \u5DF2\u4FDD\u5B58");enterGame();}
    else toast("\u5931\u8D25: "+(r.error||""));
  }catch(e){toast("\u5931\u8D25: "+e.message);}
};

// web/tm-save-manager.js. This object includes only the method under test.
var SaveManager = {
  maxSlots: 10,
  saveToSlot: async function(slotId, saveName) {
    if (slotId < 0 || slotId >= this.maxSlots) {
      toast('❌ 无效的存档槽位');
      return false;
    }
    if (typeof _tmAwaitLoadBarrier === 'function') await _tmAwaitLoadBarrier();
    if (typeof _awaitPostTurnJobsForSave === 'function') await _awaitPostTurnJobsForSave();
    var _sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
    if (typeof _buildSaveState !== 'function') throw new Error('存档快照构造器未就绪');
    var gameState = _buildSaveState({ format: 'idb' });
    if (typeof SaveMigrations !== 'undefined' && typeof SaveMigrations.stamp === 'function') {
      SaveMigrations.stamp(gameState);
    }
    var meta = {
      name: saveName || ('存档 ' + (slotId + 1)),
      type: slotId === 0 ? 'auto' : 'manual',
      turn: GM.turn,
      scenarioName: _sc ? _sc.name : '',
      eraName: GM.eraName || '',
      date: GM.date || '',
      dynastyPhase: GM.eraState ? GM.eraState.dynastyPhase : ''
    };
    var slotKey = 'slot_' + slotId;
    console.log('[saveToSlot] 保存到:', slotKey, 'IDB available:', TM_SaveDB.isAvailable());
    return TM_SaveDB.save(slotKey, gameState, meta).then(function(ok) {
      console.log('[saveToSlot] 保存结果:', ok);
      if (ok) {
        toast('\u2705 \u5DF2\u4FDD\u5B58\u5230\u69FD\u4F4D ' + (slotId + 1));
        _updateSaveIndex(slotId, meta);
      } else {
        toast('\u274C \u4FDD\u5B58\u5931\u8D25');
      }
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'saveToSlot') : console.error('[saveToSlot] 存档异常:', e); toast('\u274C \u5B58\u6863\u5F02\u5E38'); });
  }
};
