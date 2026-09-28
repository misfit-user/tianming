// Reuse Guoshi's provider, tool loop, cancellation and receipts on the native map surface.
(function(root) {
  'use strict';
  var TM=root.TM, ME=TM && TM.MapEditor, AA=TM && TM.AuthoringAgent;
  if(!ME || !ME.agentTools || !AA) return;
  var revision=0, active=null, lastUndo=null, conversation=[], conversationMap=null, committing=false;
  ['mutation','map-loaded','map-new'].forEach(function(evt) {ME.on(evt,function() {
    revision++;
    if(!committing) {conversation=[];conversationMap=null;}
  });});
  function fail(message) {throw new Error(message);}
  function capture() {
    return {map:ME.EDITOR.map,revision:revision,serial:JSON.stringify(ME.EDITOR.map)};
  }
  function current(lease) {
    return lease.map === ME.EDITOR.map && lease.revision === revision && lease.serial === JSON.stringify(ME.EDITOR.map);
  }
  function stop() {if(!active)return false; active.stopped=true; AA.abort(); return true;}
  async function run(request,options) {
    options=options || {};
    if(active) fail('国师正在处理上一条指令');
    if(typeof request !== 'string' || !request.trim()) fail('请填写地图指令');
    if(!ME.EDITOR.undo) fail('地图编辑器尚未就绪');
    if(conversationMap !== ME.EDITOR.map)conversation=[];
    if(ME.rastermaps && ME.rastermaps.commitAllDirty) ME.rastermaps.commitAllDirty();
    var lease=capture(), draft={name:ME.EDITOR.map.title || '地图',nativeMap:JSON.parse(lease.serial)};
    var task={stopped:false}, tools=ME.agentTools.specs.filter(function(s) {return !options.readOnly || s.effect !== 'draft-write';});
    ['finish','note','todoWrite','askClarification'].forEach(function(name) {
      var t=AA.AGENT_TOOLS.find(function(s) {return s.name === name;}); if(t)tools.push(t);
    });
    active=task;
    try {
      var result=await AA.runAuthoringLoop(draft,request,{
        tools:tools,caller:options.caller,cfg:options.cfg,noMemoryRecall:true,priorConversation:conversation,
        maxIterations:Infinity,maxTokens:Infinity,
        allowedCollections:['nativeMap'],conventions:ME.agentTools.skill,
        editorContext:'独立地图编辑器。选中地块 ID：'+JSON.stringify(ME.EDITOR.selectedIds || [])
          +(options.readOnly?'。玩家选择仅查看；只读地图并回答。':'。玩家已要求直接操作当前地图，完成后自动应用一次，可撤销。'),
        onStep:options.onStep,onText:options.onText
      });
      var response={ok:false,applied:false,changed:false,result:result,draft:draft};
      if(task.stopped || result.stopReason === 'aborted') {response.reason='已停止，地图未应用本次修改';return response;}
      if(!result.finished || result.stopReason !== 'finish') {
        response.reason=result.summary || result.finishSummary || '本次尚未完成，地图未应用修改';
        if(result.clarification) {
          response.reason='请补充：'+(result.clarification.questions || []).join('；');
          if(current(lease) && JSON.stringify(draft.nativeMap) === lease.serial) {
            conversation=result.conversation || [];conversationMap=ME.EDITOR.map;
          }
        }
        return response;
      }
      if(!current(lease)) {response.reason='地图已被手动修改或重新载入；国师结果已保留，请根据当前地图重新发出指令';return response;}
      var serial=JSON.stringify(draft.nativeMap), changed=serial !== lease.serial;
      if(options.readOnly && changed) fail('仅查看任务产生了修改，已拦截');
      if(changed) {
        var committed=ME.agentTools.clone(draft.nativeMap);
        // The native map-loaded handler initializes this freshness flag.
        if(draft.importedMap)committed._areaLinksStale=false;
        if(draft.importedMap && ME.arealinks){ME.arealinks.assignColorKeys(committed);ME.arealinks.buildColorKeyIndex(committed);}
        serial=JSON.stringify(committed);
        if(committed.topology && committed.topology.enabled && ME.topology) ME.topology.gridRebuild(committed);
        var before={undo:ME.EDITOR.undo.undoStack.slice(),redo:ME.EDITOR.undo.redoStack.slice(),baseline:ME.EDITOR.undo.baseline,
          dirty:ME.EDITOR.dirty,bitmap:ME.EDITOR.bitmapImage,selected:ME.EDITOR.selectedIds.slice(),feature:ME.EDITOR.selectedFeature,
          layer:ME.EDITOR.mapLayer,camera:Object.assign({},ME.EDITOR.camera)};
        // The native mutator owns history, dirty state, render and autosave notifications.
        committing=true;
        try {
          ME.commitMutation('国师：'+request.trim().slice(0,50),function() {ME.EDITOR.map=committed;});
          if(draft.importedMap) {
            ME.EDITOR.bitmapImage=null;ME.EDITOR.selectedFeature=null;ME.EDITOR.mapLayer=committed.meta.scenarioMap.defaultLevel;
            ME.EDITOR._visibleCache=null;ME.selectClear();ME.fitToContent();ME.fire('map-loaded');
          }
          ME.fire('selection-change');
          if(JSON.stringify(ME.EDITOR.map) !== serial)fail('地图写后校验不一致');
        }
        catch(error) {
          ME.EDITOR.map=lease.map;ME.EDITOR.undo.undoStack=before.undo;ME.EDITOR.undo.redoStack=before.redo;ME.EDITOR.undo.baseline=before.baseline;
          ME.EDITOR.dirty=before.dirty;ME.EDITOR.bitmapImage=before.bitmap;ME.EDITOR.selectedIds=before.selected;ME.EDITOR.selectedFeature=before.feature;
          ME.EDITOR.mapLayer=before.layer;Object.assign(ME.EDITOR.camera,before.camera);ME.EDITOR._visibleCache=null;
          ME.requestRender();ME.fire('mutation',{label:'恢复原图'});ME.fire('selection-change');
          error.message+='，已恢复原图和历史记录';throw error;
        }
        finally {committing=false;}
        lastUndo={revision:revision,map:ME.EDITOR.map,serial:serial};
      }
      response.ok=true; response.changed=changed; response.applied=changed;
      response.reason=changed?'已应用到地图，可撤销':(options.readOnly?'已完成查看':'本次未改动地图');
      if(draft.focusRegionId) {
        try {ME.agentTools.focus(draft.focusRegionId);}
        catch(e) {response.reason+='；定位目标已变化，请重新检索地块';}
      }
      conversation=result.conversation || [];conversationMap=ME.EDITOR.map;
      return response;
    } finally {if(active === task)active=null;}
  }
  function canUndo() {
    return !active && lastUndo && lastUndo.revision === revision && lastUndo.map === ME.EDITOR.map
      && lastUndo.serial === JSON.stringify(ME.EDITOR.map) && ME.undo.canUndo(ME.EDITOR.undo);
  }
  function undo() {
    if(!canUndo()) return {ok:false,reason:'地图已有后续操作，请用编辑器历史记录选择要撤销的步骤'};
    ME.doUndo(); lastUndo=null; return {ok:true};
  }
  ME.agent={run:run,stop:stop,undo:undo,canUndo:canUndo,isRunning:function() {return !!active;}};
})(typeof window !== 'undefined' ? window : globalThis);
