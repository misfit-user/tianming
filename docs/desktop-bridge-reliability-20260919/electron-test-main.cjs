'use strict';
const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createTurnDataCommitter}=require('../../main-turn-data-commit.js');
const dir=__dirname,profile=path.join(dir,'.isolated-electron-'+Date.now());fs.mkdirSync(profile,{recursive:true});
app.setPath('userData',profile);app.setPath('sessionData',profile);app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-background-networking');
const root=path.join(profile,'synthetic-turn-data');fs.mkdirSync(root);
const ensureWritableDir=dir=>fs.mkdirSync(dir,{recursive:true});
function writeFileAtomic(file,data,encoding){ensureWritableDir(path.dirname(file));const tmp=file+'.tmp';fs.writeFileSync(tmp,data,encoding);fs.renameSync(tmp,file);}
const committer=createTurnDataCommitter({fs,path,crypto,turnDataDir:root,turnDataRoot:name=>path.join(root,'legacy-'+Buffer.from(name).toString('hex')),turnSeg:t=>{if(!Number.isSafeInteger(Number(t))||Number(t)<0)throw Error('invalid turn');return String(t);},ensureWritableDir,writeFileAtomic,writeJsonAtomic:(f,d)=>writeFileAtomic(f,JSON.stringify(d),'utf8')});
let hold='',release=null,counts={};
for(const [channel,method]of [['stage-turn-data','stage'],['publish-turn-data','publish'],['recover-turn-data','recover'],['discard-turn-data','discard']]){
  ipcMain.handle(channel,(_event,payload)=>{counts[method]=(counts[method]||0)+1;const result=committer[method](payload);if(hold===method)return new Promise(resolve=>{release=()=>resolve(result);});return result;});
}
ipcMain.handle('list-save-timeline-refs',()=>({success:true,complete:true,refs:[]}));
ipcMain.handle('test-control',(_event,action,payload)=>{
  if(action==='hold'){hold=payload;return true;}
  if(action==='release'){hold='';if(release){release();release=null;}return true;}
  if(action==='inspect'){const final=path.join(committer.rootFor(payload),String(payload.turn));return {published:fs.existsSync(final),counts:{...counts},data:fs.existsSync(final)?committer.read(payload).data:null};}
  throw Error('unknown test action');
});
let ended=false;const deadline=setTimeout(()=>finish({ok:false,error:'isolated Electron test exceeded 30 seconds'}),30000);
function finish(outcome){if(ended)return;ended=true;clearTimeout(deadline);const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');const result={at:new Date().toISOString(),versions:{electron:process.versions.electron,chrome:process.versions.chrome},sourceSHA:sha(path.join(dir,'../../web/tm-endturn-reliability.js')),mainSHA:sha(path.join(dir,'../../main-turn-data-commit.js')),isolatedProfile:profile,outcome};fs.writeFileSync(path.join(dir,'electron-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));app.exit(outcome.ok?0:1);}
ipcMain.on('test-report',(_event,data)=>finish(data));
app.whenReady().then(async()=>{session.defaultSession.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith('file:')}));const win=new BrowserWindow({show:false,webPreferences:{preload:path.join(dir,'electron-test-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});await win.loadFile(path.join(dir,'electron-test.html'));}).catch(error=>finish({ok:false,error:String(error.stack||error)}));
