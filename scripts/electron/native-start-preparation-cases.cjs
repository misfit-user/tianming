'use strict';
// Production browser service and transport; no privileged evaluation inside the child.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
module.exports = async function ({ win, root, check, results }) {
  const js = code => win.webContents.executeJavaScript(code);
  const scenario = JSON.parse(fs.readFileSync(path.join(root, 'scenarios/天启七年·九月（官方）.json'), 'utf8'));
  const playerId = 'char_mp3yvbcal6op0', text = JSON.stringify(scenario), hash = crypto.createHash('sha256').update(text).digest('hex');
  await js(`(async()=>{for(const name of ['tm-start-contracts.js','tm-start-compiler.js','tm-start-preparation-document.js','tm-start-preparation.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(name,location.href).href;s.onload=resolve;s.onerror=()=>reject(Error(name));document.head.append(s);});})()`);
  await js(`window.__nativePrepareTest={scenario:JSON.parse(${JSON.stringify(text)}),gm:GM,p:P,gmText:JSON.stringify(GM),pText:JSON.stringify(P),phases:[],beats:0};`);
  try {
    await check('real service initializes official world over one-shot channel and reads back the native snapshot', async () => {
      const r = await js(`(async()=>{const t=__nativePrepareTest;const timer=setInterval(()=>t.beats++,10);try{t.result=await TM.StartPreparation.prepare(t.scenario,{expectedIdentity:{scenarioId:t.scenario.id,characterId:${JSON.stringify(playerId)}},onProgress:p=>{if(t.phases.at(-1)!==p.phase)t.phases.push(p.phase);}});const r=t.result,s=JSON.parse(r.snapshotText);return{status:r.status,sourceHash:r.sourceHash,snapshotHash:r.snapshotHash,byteLength:r.byteLength,chars:s.GM.chars.length,facs:s.GM.facs.length,player:s.GM.playerCharacterId,turn:s.GM.turn,phases:t.phases,beats:t.beats,observation:r.observation,frames:document.querySelectorAll('[data-tm-native-preparation]').length,service:TM.StartPreparation.status()};}finally{clearInterval(timer);}})()`);
      results.push({ name: 'native-preparation-service-observation', status: 'OBSERVED', value: r });
      assert.equal(r.status, 'initialized-not-committed'); assert.equal(r.sourceHash, hash); assert.match(r.snapshotHash, /^[0-9a-f]{64}$/);
      assert.equal(r.chars, scenario.characters.length); assert.equal(r.facs, scenario.factions.length); assert.equal(r.player, playerId); assert.equal(r.turn, 1);
      assert.deepEqual(r.phases, ['resources', 'booting', 'initializing', 'verifying']); assert.deepEqual(r.observation.errors, []); assert(r.beats > 0);
      assert.equal(r.frames, 0); assert.equal(r.service.phase, 'idle');
    });
    await check('source, parent world and persistent project stay unchanged after real preparation', async () => {
      const r = await js(`(async()=>{const t=__nativePrepareTest;return{same:GM===t.gm&&P===t.p,gm:JSON.stringify(GM)===t.gmText,p:JSON.stringify(P)===t.pText,sourceHash:await TM.StartCompiler.sha256(new TextEncoder().encode(JSON.stringify(t.scenario)))};})()`);
      assert(r.same && r.gm && r.p); assert.equal(r.sourceHash, hash);
    });
    await check('cancellation during real native initialization removes the frame and rejects without publishing', async () => {
      const r = await js(`(async()=>{const t=__nativePrepareTest;let cancelled=false;try{await TM.StartPreparation.prepare(t.scenario,{expectedIdentity:{scenarioId:t.scenario.id,characterId:${JSON.stringify(playerId)}},onProgress:p=>{if(p.phase==='initializing'){cancelled=TM.StartPreparation.cancel();}}});return{unexpected:true};}catch(e){await new Promise(r=>setTimeout(r,100));return{code:e.code,cancelled,frames:document.querySelectorAll('[data-tm-native-preparation]').length,same:GM===t.gm&&P===t.p,phase:TM.StartPreparation.status().phase};}})()`);
      assert.equal(r.code, 'start-cancelled'); assert(r.cancelled && r.same); assert.equal(r.frames, 0); assert.equal(r.phase, 'idle');
    });
    await check('cancel before boot and repeated confirmation cannot create a late native world', async () => {
      const r = await js(`(async()=>{const t=__nativePrepareTest,c=new AbortController();const options={signal:c.signal,expectedIdentity:{scenarioId:t.scenario.id,characterId:${JSON.stringify(playerId)}}};const p=TM.StartPreparation.prepare(t.scenario,options).catch(e=>e.code);const busy=await TM.StartPreparation.prepare(t.scenario,options).catch(e=>e.code);c.abort();const cancelled=await p;return{busy,cancelled,frames:document.querySelectorAll('[data-tm-native-preparation]').length,phase:TM.StartPreparation.status().phase};})()`);
      assert.equal(r.busy, 'native-preparation-busy'); assert.equal(r.cancelled, 'start-cancelled'); assert.equal(r.frames, 0); assert.equal(r.phase, 'idle');
    });
  } finally {
    await js(`(()=>{TM.StartPreparation.cancel();delete window.__nativePrepareTest;})()`);
  }
};
