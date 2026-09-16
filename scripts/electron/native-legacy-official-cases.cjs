'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({win,root,temp,check,mode}){
  const js=s=>win.webContents.executeJavaScript(`(async()=>{try{return{ok:true,result:await(${s})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`).then(r=>{if(!r.ok)throw Error(r.error);return r.result;});
  const which=mode.includes('shaosong')?'shaosong':'tianqi7',restart=mode.endsWith('-restart');
  const expectedFile=path.join(temp,'legacy-'+which+'-expected.json');
  if(restart){
    await check(which+' official canonical save is reloaded by a fresh production Electron process',async()=>{
      const expected=JSON.parse(fs.readFileSync(expectedFile,'utf8'));
      const result=await js(`(async()=>{const save=await TM_SaveDB.load('slot_legacy_'+${JSON.stringify(which)});if(!save)throw Error('official save missing');await fullLoadGame({gameState:save.gameState},{source:'official-native-regression',preserveTimeline:true});return{sid:GM.sid,turn:GM.turn,player:GM.playerCharacterId,characters:GM.chars.length,factions:GM.facs.length,regions:P.map.regions.length,money:GM.guoku.money,native:TM.NativeWorld.enabled(GM)};})()`);
      assert.deepEqual(result,expected);
    });return;
  }
  const entry=JSON.parse(fs.readFileSync(path.join(root,'web/bundled-scenarios/manifest.json'),'utf8')).entries.find(e=>e.key===which);
  assert(entry&&entry.active);
  // Initial update notes are an ordinary closable overlay, not a start-flow failure.
  // Click only its close control, never the separate update/apply button.
  await js(`(async()=>{await new Promise(r=>setTimeout(r,600));const close=document.querySelector('#tm-changelog-ov .tm-cl-close');if(close)close.click();})()`);
  await check(which+' unmodified official entry remains the existing single-player ceremony, without a native chooser',async()=>{
    await js(`(async()=>{await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure(${JSON.stringify(entry.id)});P.ai={key:'',url:'',model:''};const sc=P.scenarios.find(s=>s.id===${JSON.stringify(entry.id)});window.__legacySource=JSON.stringify(sc);await startGame(${JSON.stringify(entry.id)});})()`);
    const exists=await js(`({ceremony:!!document.getElementById('tm-op-enter'),chooser:!!document.querySelector('.tm-ns-dialog[open]')})`);
    assert(exists.ceremony);assert(!exists.chooser);
    const p=await js(`(async()=>{const end=Date.now()+5000;while(Date.now()<end){const e=document.getElementById('tm-op-enter'),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(e.contains(document.elementFromPoint(x,y)))return{x:Math.round(x),y:Math.round(y)};await new Promise(r=>setTimeout(r,50));}const e=document.getElementById('tm-op-enter'),r=e.getBoundingClientRect();return{blocked:true,rect:{x:r.x,y:r.y,width:r.width,height:r.height},top:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,600)};})()`);
    if(p.blocked){fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'legacy-'+which+'-blocked.png'),(await win.webContents.capturePage()).toPNG());throw Error('official start button obscured: '+JSON.stringify(p));}
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...p});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...p});
    await js(`(async()=>{const end=Date.now()+35000;while(!GM.running||GM.sid!==${JSON.stringify(entry.id)}){if(Date.now()>end)throw Error('official start timed out');await new Promise(r=>setTimeout(r,30));}})()`);
    const sourceChange=await js(`(()=>{const before=JSON.parse(__legacySource),after=P.scenarios.find(s=>s.id===${JSON.stringify(entry.id)});return Object.keys({...before,...after}).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])).map(k=>({field:k,before:JSON.stringify(before[k])?.slice(0,160),after:JSON.stringify(after[k])?.slice(0,160)}));})()`);
    assert.deepEqual(sourceChange,[],'Official template mutated: '+JSON.stringify(sourceChange));
  });
  await check(which+' real player, foreign world, fiscal stock and canonical storage retain legacy semantics',async()=>{
    const result=await js(`(async()=>{const saved=_buildSaveState({format:'idb',detach:true}),identity={campaignId:saved.GM._campaignId,timelineId:saved.GM._timelineId,turn:saved.GM.turn,transactionId:'legacy-'+${JSON.stringify(which)},schemaVersion:1},payload=await TM_SaveDB.createCanonicalPayload(saved,identity);if(!await TM_SaveDB.saveManyAtomic([{id:'slot_legacy_'+${JSON.stringify(which)},gameState:saved,canonicalPayload:payload,meta:{turn:GM.turn}}],{transactionId:identity.transactionId,writeGuard:()=>true}))throw Error('official canonical save rejected');return{sid:GM.sid,turn:GM.turn,player:GM.playerCharacterId,characters:GM.chars.length,factions:GM.facs.length,regions:P.map.regions.length,money:GM.guoku.money,native:TM.NativeWorld.enabled(GM)};})()`);
    const roster=await js(`(()=>{const sc=P.scenarios.find(s=>s.id===GM.sid);return{catalog:sc.characters.length,uniqueIds:new Set(sc.characters.filter(c=>c.id).map(c=>c.id)).size+sc.characters.filter(c=>!c.id).length,loaded:P.characters.filter(c=>c.sid===GM.sid).length,missing:sc.characters.filter(c=>c.id?!GM.chars.some(x=>x.id===c.id):GM.chars.filter(x=>x.name===c.name&&(!c.factionId||x.factionId===c.factionId)).length!==1).map(c=>c.id||c.name)};})()`);
    // Legacy startup intentionally folds duplicate rows of the SAME stable ID.
    // Preserve every authored identity and all catalog rows, not duplicate objects.
    assert.equal(roster.catalog,entry.counts.characters);assert.equal(roster.loaded,entry.counts.characters);assert.deepEqual(roster.missing,[]);
    assert.equal(result.sid,entry.id);assert(!result.native);assert(result.player);assert(result.characters>=roster.uniqueIds,JSON.stringify({result,roster}));assert(result.factions>=entry.counts.factions);assert.equal(result.regions,entry.counts.regions);assert(Number.isFinite(result.money));
    fs.writeFileSync(expectedFile,JSON.stringify(result));
    fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'legacy-'+which+'.png'),(await win.webContents.capturePage()).toPNG());
  });
};
