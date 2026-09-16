'use strict';
// Actual secure Electron renderer and actual library files, explicitly loaded by the test.
// This tests the pure library boundary; the separate entry suite tests selector/commit.
const assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const { fixture } = require('../../web/scripts/fixtures/native-start-fixture.cjs');
module.exports = async function ({ win, root, check, results }) {
  const js = code => win.webContents.executeJavaScript(code);
  const f = fixture(), serial = JSON.stringify(f.scenario);
  await check('core libraries load as real same-origin script resources under production CSP', async () => {
    const r = await js(`(async()=>{for(const name of ['tm-start-contracts.js','tm-start-compiler.js']){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(name,location.href).href;s.onload=resolve;s.onerror=()=>reject(Error('script load failed: '+name));document.head.append(s);});}return{contracts:typeof TM.StartContracts.inspect,compiler:typeof TM.StartCompiler.compile,node:typeof require,secure:isSecureContext};})()`);
    assert.equal(r.contracts, 'function'); assert.equal(r.compiler, 'function'); assert.equal(r.node, 'undefined'); assert(r.secure);
    results.push({ name: 'native-core-loading-scope', status: 'PASS', value: 'test-added real script resources; selector/commit is covered by the separate native-start-entry suite',
      sources: Object.fromEntries(['tm-start-contracts.js', 'tm-start-compiler.js'].map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'web', name))).digest('hex')])) });
  });
  await js(`(async()=>{await TMOfficialScenarioLoader.ready();await new Promise(r=>setTimeout(r,500));window.__nativeCoreTest={input:JSON.parse(${JSON.stringify(serial)}),bytes:new Uint8Array(${JSON.stringify(Array.from(f.bytes))}),beforeGM:window.GM,beforeP:window.P,gmText:JSON.stringify(window.GM),pText:JSON.stringify(window.P)};})()`);
  try {
    await check('real WebCrypto locks source and reads preview summaries without cloning', async () => {
      const r = await js(`(async()=>{const t=__nativeCoreTest;t.handle=await TM.StartCompiler.createSource(t.input,{capabilities:['test-native-v1']});for(let i=0;i<30;i++)TM.StartCompiler.previews(t.handle,'乙公国');return{hash:t.handle.hash,stats:TM.StartCompiler.stats(t.handle),rows:TM.StartCompiler.previews(t.handle,'乙公国').length};})()`);
      assert.equal(r.hash, crypto.createHash('sha256').update(serial).digest('hex')); assert.equal(r.stats.cloneCount, 0); assert.equal(r.rows, 3);
    });
    await check('secure renderer prepares representative candidate without altering current game, source or leader', async () => {
      const r = await js(`(async()=>{const t=__nativeCoreTest;t.candidate=await TM.StartCompiler.compile(t.handle,'pr',{sessionId:'electron-core-session',resolveMapAsset:async()=>t.bytes});const c=t.candidate;return{status:c.status,player:c.character.id,role:c.startContext.roleKind,leader:c.faction.leaderCharacterId,worldChars:c.worldRegistry.characters.length,worldClasses:c.worldRegistry.classes.length,shared:c.playerView.classes[0]===c.scenario.classes[1],sameWorld:window.GM===t.beforeGM&&window.P===t.beforeP,gmSame:JSON.stringify(window.GM)===t.gmText,pSame:JSON.stringify(window.P)===t.pText,input:JSON.stringify(t.input),clones:TM.StartCompiler.stats(t.handle).cloneCount};})()`);
      assert.equal(r.status, 'prepared-not-started'); assert.equal(r.player, 'cr'); assert.equal(r.role, 'delegatedRepresentative'); assert.equal(r.leader, 'cb');
      assert.equal(r.worldChars, 5); assert.equal(r.worldClasses, 2); assert(r.shared && r.sameWorld && r.gmSame && r.pSame,JSON.stringify({shared:r.shared,sameWorld:r.sameWorld,gmSame:r.gmSame,pSame:r.pSame})); assert.equal(r.input, serial); assert.equal(r.clones, 1);
    });
    await check('real renderer cancellation rejects an unresponsive asset service and discards its source', async () => {
      const r = await js(`(async()=>{const t=__nativeCoreTest,h=await TM.StartCompiler.createSource(t.input,{capabilities:['test-native-v1']});const pending=TM.StartCompiler.compile(h,'pb',{sessionId:'cancel-core',resolveMapAsset:()=>new Promise(()=>{})});TM.StartCompiler.cancel(h);try{await pending;return{unexpected:true};}catch(e){return{code:e.code,sameWorld:window.GM===t.beforeGM&&window.P===t.beforeP};}})()`);
      assert.equal(r.code, 'start-cancelled'); assert(r.sameWorld); assert(!r.unexpected);
    });
    // Feasibility measurement only: whether an opaque sandbox can host the existing initializer.
    // A missing initializer is an honest negative observation, not a reason to weaken CSP.
    await js(`(()=>{const f=document.createElement('iframe');f.id='native-preparation-isolation-probe';f.name='native-preparation-isolation-probe';f.sandbox='allow-scripts';f.style.display='none';f.src=new URL('index.html',location.href).href;document.body.append(f);})()`);
    let frame;
    for (let i = 0; i < 80; i++) {
      frame = win.webContents.mainFrame.frames.find(f => f.name === 'native-preparation-isolation-probe' && /index\.html/.test(f.url));
      if (frame) { const ready = await frame.executeJavaScript('document.readyState').catch(() => 'loading'); if (ready === 'complete') break; }
      await new Promise(r => setTimeout(r, 100));
    }
    await check('opaque-frame feasibility probe preserves storage and parent-world isolation', async () => {
      assert(frame, 'actual child frame exists');
      const r = await frame.executeJavaScript(`(()=>{let storageDenied=false,parentDenied=false;try{void localStorage.length;}catch(e){storageDenied=e.name==='SecurityError';}try{void parent.GM;}catch(e){parentDenied=e.name==='SecurityError';}return{ready:document.readyState,frameName:window.name,title:document.title,scripts:document.scripts.length,csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content||null,storageDenied,parentDenied,bridge:typeof window.tianming,node:typeof require,initializer:typeof doActualStart,startEntry:typeof startGame,coreGlobals:typeof P};})()`);
      assert.equal(r.frameName, 'native-preparation-isolation-probe');
      assert(r.storageDenied && r.parentDenied); assert.equal(r.bridge, 'undefined'); assert.equal(r.node, 'undefined');
      results.push({ name: 'opaque-frame-native-readiness-observation', status: 'PASS', value: r,
        meaning: 'diagnostic only; no new game initialized, no selector/start/commit acceptance claimed' });
    });
  } finally {
    await js(`(()=>{document.getElementById('native-preparation-isolation-probe')?.remove();if(window.__nativeCoreTest?.handle)TM.StartCompiler.cancel(__nativeCoreTest.handle);delete window.__nativeCoreTest;})()`);
  }
};
