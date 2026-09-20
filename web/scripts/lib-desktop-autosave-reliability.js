'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'../..'),clone=v=>JSON.parse(JSON.stringify(v));
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(root=ROOT){
  const calls=[],timers=new Map(),events=[];let token='autosave-session-fixture-0001',api,seq=0;
  let reply=(_channel,payload)=>Promise.resolve({success:true,sessionToken:payload&&payload.sessionToken});
  const ipc={sendSync(channel,value){if(channel==='auto-save-session-rotate')token=value;return {success:true,token};},
    invoke(channel,payload){calls.push({channel,payload:clone(payload)});return Promise.resolve(reply(channel,payload));},on(){},removeListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'preload-impl.js'),'utf8'),{
    require(name){assert.equal(name,'electron');return {ipcRenderer:ipc,contextBridge:{exposeInMainWorld(name,value){assert.equal(name,'tianming');api=value;}}};},
    process:{platform:'win32'},Buffer,console:{warn(){},error(){},log(){}},crypto:require('crypto').webcrypto
  },{filename:'preload-impl.js'});
  const c={console:{warn(){events.push('warning');},error(){events.push('error');},log(){}},Date,Promise,JSON,
    setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
    GM:{running:true,turn:8,sid:'fixture',saveName:'中文存档😀',_campaignId:'campaign-fixture',_timelineId:'timeline-fixture',fullNarrative:'完整正文与长期记忆。'.repeat(100)},
    P:{conf:{quality:'full'},scenarios:[]},_tmLoadGen:1,tianming:api,deepClone:clone,_tmLiteSafeConf:clone,
    localStorage:{setItem(){events.push('lite-write');},removeItem(){}},findScenarioById:()=>({name:'完整剧本'}),_tmHasNativeFs:()=>true};
  c.window=c;c.globalThis=c;vm.createContext(c);
  const source=fs.readFileSync(path.join(root,'web/tm-save-lifecycle.js'),'utf8');
  const start=source.indexOf('var _autoSaveInFlight=false;'),end=source.indexOf('if(_tmHasNativeFs()){',start);assert(start>=0&&end>start);
  vm.runInContext(source.slice(start,end),c,{filename:'tm-save-lifecycle.js'});
  c._tmAwaitBackgroundAutosaves=async()=>({ok:true});
  vm.runInContext(fs.readFileSync(path.join(root,'web/tm-save-close-flush.js'),'utf8'),c,{filename:'tm-save-close-flush.js'});
  function adopt(){return c._tmAdoptCommittedWorldSnapshot({GM:c.GM,P:c.P},{transactionId:'committed-'+c.GM.turn});}adopt();
  function fire(ms){let count=0;for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();count++;}return count;}
  return {c,api,calls,timers,events,adopt,fire,setReply(fn){reply=fn;},save:()=>c._tmRunDesktopAutoSaveTick({force:true}),status:()=>c._tmDesktopAutoSaveTransportStatus&&c._tmDesktopAutoSaveTransportStatus()};
}
module.exports={fixture,tick,clone,ROOT};
