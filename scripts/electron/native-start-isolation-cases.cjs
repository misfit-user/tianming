'use strict';
// Feasibility gate for REAL native initialization in an opaque-origin document.
// Storage in that candidate document is explicitly volatile, never a saved game.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { build } = require('./native-preparation-document.cjs');
module.exports = async function ({ win, root, check, results }) {
  const js = code => win.webContents.executeJavaScript(code), built = build(root);
  const scenario = JSON.parse(fs.readFileSync(path.join(root, 'scenarios/天启七年·九月（官方）.json'), 'utf8'));
  let frame;
  await js(`(()=>{const f=document.createElement('iframe');f.name='native-isolated-runtime-probe';f.id=f.name;f.sandbox='allow-scripts';f.setAttribute('aria-hidden','true');f.style.cssText='position:fixed;left:-20000px;top:0;width:1280px;height:800px;border:0;visibility:hidden;pointer-events:none';f.srcdoc=${JSON.stringify(built.html)};document.body.append(f);})()`);
  try {
    for (let i = 0; i < 200; i++) {
      frame = win.webContents.mainFrame.frames.find(f => f.name === 'native-isolated-runtime-probe');
      if (frame) {
        const ready = await frame.executeJavaScript('!!window.__tmNativePreparationProbe?.ready').catch(() => false);
        if (ready) break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    await check('pinned native runtime loads in a network-denied opaque origin without Node or desktop bridge', async () => {
      assert(frame, 'the expected isolated frame exists');
      const r = await frame.executeJavaScript(`(()=>{let denied=false;try{void parent.GM;}catch(e){denied=e.name==='SecurityError';}return{probe:window.__tmNativePreparationProbe,initializer:typeof doActualStart,entry:typeof startGame,project:typeof P,game:typeof GM,node:typeof require,bridge:typeof window.tianming,parentDenied:denied,policy:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content};})()`);
      results.push({ name: 'native-isolation-load-observation', status: 'OBSERVED', value: r, scriptCount: built.scriptCount,
        styleCount: built.styleCount, indexHash: built.originalIndexHash, inputs: built.inputs });
      assert(r.parentDenied); assert.equal(r.node, 'undefined'); assert.equal(r.bridge, 'undefined'); assert.equal(r.probe.storage, 'volatile-only');
      assert.match(r.policy, /connect-src 'none'/); assert.match(r.policy, /worker-src 'none'/);
      assert.match(r.policy, /script-src 'nonce-/); assert(!/script-src[^;]*unsafe-inline/.test(r.policy));
      assert.equal(r.initializer, 'function', JSON.stringify(r.probe.errors)); assert.equal(r.entry, 'function'); assert.equal(r.project, 'object');
    });
    await check('scenario-like unsigned inline scripts cannot execute in the prepared document', async () => {
      const r = await frame.executeJavaScript(`(()=>{window.__unsignedProbeRan=false;const s=document.createElement('script');s.textContent='window.__unsignedProbeRan=true';document.head.append(s);s.remove();return window.__unsignedProbeRan;})()`);
      assert.equal(r, false);
    });
    const resourceObservation = await js(`(async()=>{try{const r=await fetch(new URL('tm-start-compiler.js',location.href));return{ok:r.ok,status:r.status,bytes:(await r.arrayBuffer()).byteLength};}catch(e){return{error:String(e.message)};}})()`);
    results.push({ name: 'native-isolation-resource-process-observation', status: 'OBSERVED', value: {
      parentProcessId: win.webContents.mainFrame.processId, childProcessId: frame.processId, parentLocalFetch: resourceObservation
    } });
    await js(`window.__nativeIsolationParent={gm:window.GM,p:window.P,gmText:JSON.stringify(window.GM),scenarioIds:(window.P?.scenarios||[]).map(s=>s.id).join('|')}`);
    await check('actual official new-game initializer produces a detached world and native save snapshot', async () => {
      const r = await frame.executeJavaScript(`(()=>{const source=JSON.parse(${JSON.stringify(JSON.stringify(scenario))});window.__sourceBefore=JSON.stringify(source);P.scenarios=(P.scenarios||[]).filter(s=>s.id!==source.id).concat([source]);P.ai={key:'',url:'',model:''};doActualStart(source.id);const saved=_buildSaveState({format:'idb',detach:true});return{running:GM.running,sid:GM.sid,chars:GM.chars.length,factions:GM.facs.length,player:GM.playerCharacterId,snapshotPlayer:saved.GM.playerCharacterId,turn:saved.GM.turn,sourceUnchanged:JSON.stringify(source)===window.__sourceBefore,snapshotHasKey:!!saved.P.ai?.key,errors:window.__tmNativePreparationProbe.errors.slice(0,20)};})()`);
      results.push({ name: 'native-isolation-initialized-world', status: 'OBSERVED', value: r });
      assert(r.running); assert.equal(r.sid, scenario.id); assert.equal(r.chars, scenario.characters.length); assert.equal(r.factions, scenario.factions.length);
      assert.equal(r.player, 'char_mp3yvbcal6op0'); assert.equal(r.snapshotPlayer, r.player); assert.equal(r.turn, 1); assert(r.sourceUnchanged); assert(!r.snapshotHasKey);
      const parent = await js(`(()=>{const p=__nativeIsolationParent;return{same:GM===p.gm&&P===p.p,gm:JSON.stringify(GM)===p.gmText,scenarios:(P.scenarios||[]).map(s=>s.id).join('|')===p.scenarioIds};})()`);
      assert(parent.same && parent.gm && parent.scenarios, 'private initialization must not publish or modify the parent world');
    });
  } finally {
    await js(`(()=>{document.getElementById('native-isolated-runtime-probe')?.remove();delete window.__nativeIsolationParent;})()`);
  }
};
