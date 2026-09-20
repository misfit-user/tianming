'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),acorn=require('../../node_modules/acorn');
const root=path.resolve(__dirname,'../..'),profile=path.join(__dirname,'.isolated-autosave-'+Date.now());fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
const source=fs.readFileSync(path.join(root,'main-impl.js'),'utf8'),tree=acorn.parse(source,{ecmaVersion:'latest'});
const names=['ensureWritableDir','ensureSaveDir','writeFileAtomic','writeJsonAtomic','desktopSaveMetadataPath','desktopSaveGenerationPath','normalizeDesktopSaveGeneration','desktopSaveGenerationFromData','prepareDesktopSavePayload','desktopSavePayloadStamp','desktopSaveMetadataFromData','writeDesktopSaveGeneration','invalidateDesktopSaveGeneration','writeDesktopSaveMetadata'];
const helpers=names.map(name=>{const n=tree.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);if(!n)throw Error(name);return source.slice(n.start,n.end);}).join('\n');
const start=source.indexOf('const AUTO_SAVE_FILE ='),loadAt=source.indexOf("ipcMain.handle('load-auto-save'",start),end=tree.body.find(n=>n.start===loadAt).end;
let holdNext=false,release=null,calls=0,windowRef;
const proxy={on:(...args)=>ipcMain.on(...args),handle(name,handler){ipcMain.handle(name,async(event,payload)=>{
  if(name!=='auto-save')return handler(event,payload);calls++;const hold=holdNext;holdNext=false;const answer=await handler(event,payload);
  if(hold)await new Promise(resolve=>{release=resolve;});return answer;
});}};
const scope={fs,path,crypto,process,console,ipcMain:proxy,readJsonFileOffMainThread:require('../../main-json-file.js').readJsonFileOffMainThread};
for(const name of ['SAVE_DIR','SAVE_METADATA_DIR','SCENARIOS_DIR','TURN_DATA_DIR','UPDATE_DIR','OFFICIAL_CONTENT_DIR','WORKSHOP_DIR','WORKSHOP_PACKS_DIR','HOT_UPDATE_DIR','HOT_UPDATE_VERSIONS_DIR'])scope[name]=path.join(profile,name);
vm.runInNewContext(helpers+'\n'+source.slice(start,end),scope,{filename:'actual-main-autosave-slice.js'});
function writeResult(outcome){const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');const files=['main-impl.js','preload-impl.js','web/tm-save-lifecycle.js','web/tm-save-close-flush.js'];
 fs.writeFileSync(path.join(__dirname,'native-result.json'),JSON.stringify({at:new Date().toISOString(),versions:process.versions,profile,sourceHashes:Object.fromEntries(files.map(f=>[f,sha(f)])),outcome},null,2));}
ipcMain.handle('fixture-control',(_event,cmd,value)=>{
 if(cmd==='arm'){holdNext=true;return true;}if(cmd==='status')return {held:!!release,calls};
 if(cmd==='release'){const fn=release;release=null;if(fn)fn();return true;}
 if(cmd==='disk')return JSON.parse(fs.readFileSync(path.join(scope.SAVE_DIR,'__autosave__.json'),'utf8'));
 if(cmd==='done'){writeResult(value);setTimeout(()=>app.quit(),100);return true;}throw Error('Unknown test action');
});
app.whenReady().then(async()=>{windowRef=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'native-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 windowRef.webContents.session.webRequest.onBeforeRequest({urls:['*://*/*']},(_details,callback)=>callback({cancel:true}));
 windowRef.webContents.setWindowOpenHandler(()=>({action:'deny'}));await windowRef.loadFile(path.join(__dirname,'native-test.html'));
});
setTimeout(()=>{writeResult({ok:false,error:'Native harness deadline'});app.exit(2);},30000).unref();
