'use strict';
// Hidden real-Electron fixture. The parent supplies a fresh disposable profile.
const electron = require('electron'), fs = require('fs'), path = require('path'), vm = require('vm');
const { app, BrowserWindow } = electron;
const dir = process.env.TM_PROFILE_FIXTURE_DIR, run = process.env.TM_PROFILE_FIXTURE_RUN;
if (!dir || !run) throw Error('Explicit fixture directory and run ID are required');
app.setPath('userData', path.join(dir, 'profile')); app.setPath('sessionData', path.join(dir, 'profile'));
app.disableHardwareAcceleration();
function report(value) { fs.writeFileSync(path.join(dir, run + '.json'), JSON.stringify(value)); }
function implementation() {
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    await win.loadFile(path.join(dir, 'fixture.html'));
    const data = await win.webContents.executeJavaScript(`(async()=>{
      const before=localStorage.getItem('tm_fixture_key');
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('tm_profile_fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const previous=await new Promise((resolve,reject)=>{const r=db.transaction('saves').objectStore('saves').get('fixture');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});
      if(!before){localStorage.setItem('tm_fixture_key','fake-test-key');await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({turn:12,conf:{retained:true}},'fixture');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}
      db.close();return {before,previous,after:localStorage.getItem('tm_fixture_key')};
    })()`);
    report({ ok: true, pid: process.pid, ...data });
    const timer = setInterval(() => { if (fs.existsSync(path.join(dir, run + '.quit'))) { clearInterval(timer); app.quit(); } }, 50);
  }).catch(error => { report({ ok: false, error: error.message }); app.quit(); });
}
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../main.js'), 'utf8'), {
  process, console,
  require(name) { if (name === 'electron') return electron; if (name === './main-impl.js') return implementation(); return require(name); }
}, { filename: 'main.js' });
