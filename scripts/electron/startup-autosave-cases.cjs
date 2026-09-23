'use strict';
// Real desktop autosave IPC, two renderer restarts, then the player's opt-in load UI.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
module.exports = async function ({ win, root, temp, controls, check }) {
  win.show(); win.focus(); assert(win.isVisible(), 'startup acceptance requires a visible native window');
  const js = code => win.webContents.executeJavaScript(`(async()=>(${code}))()`, true);
  const scenario = JSON.parse(fs.readFileSync(path.join(root, 'scenarios/天启七年·九月（官方）.json'), 'utf8'));
  const expected = await js(`(async()=>{await TM_Changelog.getUnreadCount();TM_Changelog.markRead();TM_Changelog.close();
    P.scenarios=[${JSON.stringify(scenario)}];P.ai={key:'',url:'',model:''};doActualStart(${JSON.stringify(scenario.id)});
    await _tmAwaitLoadBarrier();const snapshot=_buildSaveState({format:'project',detach:true});
    const result=await tianming.autoSave(snapshot);if(!result.success)throw Error(result.error||'native autosave failed');
    const project=_tmStripAiKeyInPlace(deepClone(P));project.conf=project.conf||{};project.conf.__startupReadProbe='primary-project';await TM_SaveDB.saveProject(project);
    return{sid:GM.sid,turn:GM.turn,ids:[...new Set(GM.chars.map(c=>c.id))].sort()};})()`);
  const file = path.join(temp, 'saves/__autosave__.json'), original = fs.readFileSync(file);
  await check('real running T1 autosave exists and the validated native reader can read it', async () => {
    const saved = await js(`tianming.loadAutoSave().then(r=>({success:r.success,turn:r.data&&r.data.gameState&&r.data.gameState.turn}))`);
    assert(saved.success); assert.equal(saved.turn, expected.turn); assert.equal(expected.turn, 1);
  });
  for (let restart = 1; restart <= 2; restart++) await check('restart ' + restart + ' keeps the menu open and preserves the autosave without prompting or loading', async () => {
    const reads = controls.startupAutoSaveReads || 0;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('renderer reload deadline exceeded')), 15000);
      win.webContents.once('did-finish-load', () => { clearTimeout(timer); resolve(); });
      win.webContents.reloadIgnoringCache();
    });
    const deadline = Date.now() + 10000;
    while (!(await js(`P.conf&&P.conf.__startupReadProbe==='primary-project'`))) { if (Date.now() > deadline) throw Error('primary project did not restore'); await new Promise(r => setTimeout(r, 25)); }
    assert.equal(controls.startupAutoSaveReads || 0,reads,'healthy startup must not transfer the complete desktop backup');
    const state = await js(`(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const launch=document.getElementById('launch'),b=launch.getBoundingClientRect();
      return{running:GM.running,menu:getComputedStyle(launch).display!=='none'&&b.width>0&&b.height>0,provider:typeof desktopLoadAutoSave};})()`);
    assert.equal(state.running, false); assert(state.menu, JSON.stringify(state)); assert.equal(state.provider, 'function');
    assert(fs.readFileSync(file).equals(original), 'startup must not rewrite or delete the existing backup');
    if (restart === 2) fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'startup-without-prompt.png'), (await win.webContents.capturePage()).toPNG());
  });
  await check('the existing load manager exposes a styled manual desktop-backup entry and restores the full game', async () => {
    const entry = await js(`(async()=>{const notice=document.querySelector('.tm-cl-foot button[onclick="TM_Changelog.markRead()"]');if(notice)notice.click();
      doLoadSave();const deadline=Date.now()+15000;let button;
      while(!(button=document.querySelector('#save-manager-overlay button[onclick="loadDesktopAutoSave()"]'))){if(Date.now()>deadline)throw Error('manual recovery button missing');await new Promise(r=>setTimeout(r,25));}
      button.scrollIntoView({block:'center',behavior:'instant'});let hit,b;
      while(Date.now()<deadline){const lateNotice=document.querySelector('.tm-cl-foot button[onclick="TM_Changelog.markRead()"]');if(lateNotice)lateNotice.click();
        b=button.getBoundingClientRect();hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);let opaque=true;
        for(let n=button;n;n=n.parentElement)if(Number(getComputedStyle(n).opacity)<0.99)opaque=false;
        if(button.contains(hit)&&opaque)return{ready:true};await new Promise(r=>setTimeout(r,25));}
      return{ready:false,rect:b&&b.toJSON(),hit:hit&&{id:hit.id,cls:hit.className,text:hit.textContent.slice(0,150)}};})()`);
    win.show(); win.focus(); await new Promise(resolve => setTimeout(resolve, 300));
    fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'manual-recovery-panel.png'), (await win.webContents.capturePage()).toPNG());
    assert(entry.ready, 'manual recovery entry is not visibly clickable: ' + JSON.stringify(entry));
    const result = await js(`(async()=>{const deadline=Date.now()+15000,button=document.querySelector('#save-manager-overlay button[onclick="loadDesktopAutoSave()"]');
      button.click();const ok=document.querySelector('.rice-paper-confirm #_rpc_ok');if(!ok)throw Error('explicit load confirmation missing');ok.click();
      while(!GM.running||document.getElementById('save-manager-overlay')){if(Date.now()>deadline)throw Error('manual full-load deadline exceeded');await new Promise(r=>setTimeout(r,25));}
      return{sid:GM.sid,turn:GM.turn,ids:GM.chars.map(c=>c.id).sort(),pending:!!GM._loadHydrationPending};})()`);
    // Compare every stable identity, not just a count: authored names must survive load cleanup.
    assert.equal(result.sid, expected.sid); assert.equal(result.turn, expected.turn); assert.deepEqual(result.ids, expected.ids); assert.equal(result.pending, false);
    assert(fs.readFileSync(file).equals(original), 'successful manual recovery retains the backup');
  });
};
