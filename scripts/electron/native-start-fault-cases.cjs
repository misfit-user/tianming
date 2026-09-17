'use strict';
const assert = require('assert/strict');
const world = require('./native-start-entry-cases.cjs').world;
module.exports = async function ({ win, check, results }) {
  const js = async (c) => {
    const r = await win.webContents.executeJavaScript(
      `(async()=>{try{return{ok:true,result:await(${c})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`,
    );
    if (!r.ok) throw Error(r.error);
    return r.result;
  };
  const wait = async (expr) =>
    js(
      `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expr})return;await new Promise(r=>setTimeout(r,40));}throw Error('wait expired '+JSON.stringify(TM.NativeStart.status()));})()`,
    );
  await js(`(async()=>{await TMOfficialScenarioLoader.ready();P.ai={key:'',url:'',model:''};const source=${JSON.stringify(world())},old=JSON.parse(JSON.stringify(source));delete old.nativeStart;old.id='native-fault-old';old.characters[0].name='原局甲君';old.characters[1].name='原局乙君';old.playerInfo={characterId:'ca',characterName:'原局甲君',factionId:'fa',factionName:'甲国'};P.scenarios.push(old,source);doActualStart(old.id);await new Promise(r=>setTimeout(r,500));
    const saved=_buildSaveState({format:'idb',detach:true});saved.GM.busy=false;const tx='native-old-fixture',identity={campaignId:saved.GM._campaignId,timelineId:saved.GM._timelineId,turn:saved.GM.turn,transactionId:tx,schemaVersion:1};const payload=await TM_SaveDB.createCanonicalPayload(saved,identity);
    if(!await TM_SaveDB.saveManyAtomic([{id:'autosave',gameState:saved,canonicalPayload:payload,meta:{turn:GM.turn}},{id:'slot_0',gameState:saved,canonicalPayload:payload,meta:{turn:GM.turn}}],{transactionId:tx,writeGuard:()=>true}))throw Error('old save not seeded');
    window.__nsFault={gm:GM,p:P,source,oldMoney:GM.guoku.money,oldSave:JSON.stringify((await TM_SaveDB.load('autosave')).gameState),oldSlot:JSON.stringify((await TM_SaveDB.load('slot_0')).gameState)};
    window.__nsLease=async()=>({gm:GM,p:P,epoch:Number(_tmStartRequestEpoch||0),turn:GM.turn,loadGen:Number(window._tmLoadGen||0),sourceScenario:__nsFault.source,sourceHash:await TM.StartCompiler.sha256(new TextEncoder().encode(JSON.stringify(__nsFault.source)))});
  })()`);
  await check(
    'missing or dead characters, false head relationships and unavailable capabilities cannot start or replace canonical saves',
    async () => {
      const rows = [];
      for (const kind of ['missing-character', 'dead-character', 'not-head', 'missing-capability']) {
        const source = world();
        source.id = 'invalid-native-' + kind;
        if (kind === 'missing-character')
          source.nativeStart.profiles.find((p) => p.id === 'pb').playerCharacterId = 'does-not-exist';
        if (kind === 'dead-character') source.characters.find((c) => c.id === 'cb').alive = false;
        if (kind === 'not-head') source.factions.find((f) => f.id === 'fb').leaderCharacterId = 'cc';
        if (kind === 'missing-capability')
          source.nativeStart.rulesets
            .find((r) => r.id === 'rules-fb')
            .requiredCapabilities.push('deliberately-unavailable');
        await js(
          `(async()=>{P.scenarios.push(${JSON.stringify(source)});await startGame(${JSON.stringify(source.id)});})()`,
        );
        await wait(`TM.NativeStart.status().phase==='choosing'`);
        const r = await js(
          `(async()=>{document.querySelector('[data-profile="pb"]').click();const start=document.querySelector('.tm-ns-start'),disabled=start.disabled,text=document.querySelector('.tm-ns-detail').textContent;start.click();await new Promise(r=>setTimeout(r,50));return{disabled,text,same:GM===__nsFault.gm&&P===__nsFault.p,phase:TM.NativeStart.status().phase,autosave:JSON.stringify((await TM_SaveDB.load('autosave')).gameState)===__nsFault.oldSave,slot:JSON.stringify((await TM_SaveDB.load('slot_0')).gameState)===__nsFault.oldSlot};})()`,
        );
        assert(r.disabled && r.same && r.autosave && r.slot, JSON.stringify({ kind, ...r }));
        assert.equal(r.phase, 'choosing');
        assert.match(r.text, /不存在|死亡|元首|能力|缺失|关系|身份/);
        rows.push({ kind, disabled: r.disabled, reason: r.text });
        await js(`TM.NativeStart.cancel(true)`);
      }
      results.push({ name: 'native-invalid-profile-observations', status: 'OBSERVED', value: rows });
    },
  );
  await check('cancelling during preparation cannot later replace the old world', async () => {
    await js(`startGame('synthetic-world')`);
    await wait(`TM.NativeStart.status().phase==='choosing'`);
    await js(
      `(()=>{document.querySelector('[data-profile="pb"]').click();document.querySelector('.tm-ns-start').click();if(!TM.NativeStart.cancel(true))throw Error('cancel rejected before commit');})()`,
    );
    await new Promise((r) => setTimeout(r, 500));
    const r = await js(
      `({same:GM===__nsFault.gm&&P===__nsFault.p,phase:TM.NativeStart.status().phase,frames:document.querySelectorAll('[data-tm-native-preparation]').length})`,
    );
    assert(r.same);
    assert.equal(r.phase, 'idle');
    assert.equal(r.frames, 0);
  });
  await check('source revision changed after real preparation rejects the old candidate before any write', async () => {
    await js(
      `(()=>{const original=TM.StartPreparation.prepare;TM.StartPreparation.prepare=async(...args)=>{try{const r=await original(...args);__nsFault.prepared=r;__nsFault.source.revisionMarker='changed-during-prepare';return r;}finally{TM.StartPreparation.prepare=original;}};})()`,
    );
    await js(`startGame('synthetic-world')`);
    await wait(`TM.NativeStart.status().phase==='choosing'`);
    await js(
      `(()=>{document.querySelector('[data-profile="pb"]').click();document.querySelector('.tm-ns-start').click();})()`,
    );
    await wait(`TM.NativeStart.status().phase==='failed'`);
    const r = await js(
      `({same:GM===__nsFault.gm,text:document.querySelector('.tm-ns-status').textContent,saved:JSON.stringify((await TM_SaveDB.load('autosave')).gameState)===__nsFault.oldSave,frames:document.querySelectorAll('[data-tm-native-preparation]').length})`,
    );
    assert(r.same && r.saved);
    assert.match(r.text, /源剧本已更新/);
    assert.equal(r.frames, 0);
    await js(`(()=>{delete __nsFault.source.revisionMarker;TM.NativeStart.cancel(true);})()`);
  });
  await check('altered prepared bytes fail before load or canonical save', async () => {
    const r = await js(
      `(async()=>{try{await TM.StartCommit.commit({...__nsFault.prepared,snapshotText:__nsFault.prepared.snapshotText+' '},await __nsLease());return{error:'none'};}catch(e){return{error:e.code,same:GM===__nsFault.gm};}})()`,
    );
    assert.equal(r.error, 'native-commit-hash');
    assert(r.same);
  });
  await check('actual IDB write-guard abort rolls native load back and preserves both canonical slots', async () => {
    const r = await js(
      `(async()=>{const original=TM_SaveDB.saveManyAtomic;let guards=0;TM_SaveDB.saveManyAtomic=(rows,opts)=>original(rows,{...opts,writeGuard:()=>{guards++;return false;}});let code;try{await TM.StartCommit.commit(__nsFault.prepared,await __nsLease());}catch(e){code=e.code||e.message;}finally{TM_SaveDB.saveManyAtomic=original;}return{code,guards,same:GM===__nsFault.gm,money:GM.guoku.money,oldMoney:__nsFault.oldMoney,busy:GM.busy,txn:!!window._tmActiveLoadTransaction,autosave:JSON.stringify((await TM_SaveDB.load('autosave')).gameState)===__nsFault.oldSave,slot:JSON.stringify((await TM_SaveDB.load('slot_0')).gameState)===__nsFault.oldSlot};})()`,
    );
    results.push({ name: 'native-rollback-observation', status: 'OBSERVED', value: r });
    assert(r.code);
    assert(r.guards > 0);
    assert(r.same && r.autosave && r.slot);
    assert.equal(r.money, r.oldMoney);
    assert(!r.busy && !r.txn);
  });
  await check('a failed commit is retryable once, but the successful candidate cannot commit twice', async () => {
    const r = await js(
      `(async()=>{const first=await TM.StartCommit.commit(__nsFault.prepared,await __nsLease());let duplicate;try{await TM.StartCommit.commit(__nsFault.prepared,await __nsLease());}catch(e){duplicate=e.code;}return{first,duplicate,current:GM.playerCharacterId,profile:GM.startContext.startProfileId,loadBusy:!!window._tmActiveLoadTransaction,money:GM.guoku.money};})()`,
    );
    assert.equal(r.first.status, 'started');
    assert.equal(r.duplicate, 'native-commit-reentry');
    assert.equal(r.current, 'cb');
    assert.equal(r.profile, 'pb');
    assert.equal(r.money, 7);
    assert(!r.loadBusy);
  });
};
