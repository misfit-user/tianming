'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('tianming',{
  isDesktop:true,turnDataProtocolVersion:2,
  stageTurnData:p=>ipcRenderer.invoke('stage-turn-data',p),
  publishTurnData:p=>ipcRenderer.invoke('publish-turn-data',p),
  recoverTurnData:p=>ipcRenderer.invoke('recover-turn-data',p),
  discardTurnData:p=>ipcRenderer.invoke('discard-turn-data',p),
  listSaveTimelineRefs:()=>ipcRenderer.invoke('list-save-timeline-refs')
});
contextBridge.exposeInMainWorld('testBridge',{
  control:(action,payload)=>ipcRenderer.invoke('test-control',action,payload),
  report:data=>ipcRenderer.send('test-report',data)
});
