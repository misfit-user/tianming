'use strict';
// The production preload is loaded unchanged; only fixture orchestration uses this extra channel.
require('../../preload-impl.js');
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('autosaveFixture',{control:(cmd,value)=>ipcRenderer.invoke('fixture-control',cmd,value)});
