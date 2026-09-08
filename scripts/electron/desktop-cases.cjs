'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), { Worker } = require('worker_threads');
module.exports = async function({ win, root, temp, mode, controls, check }) {
  const js = code => win.webContents.executeJavaScript(code);
  const call = (name, ...args) => js('window.tianming[' + JSON.stringify(name) + '](...' + JSON.stringify(args) + ')');
  const wait = async fn => { const end = Date.now() + 10000; while (!fn()) { if (Date.now() > end) throw new Error('test barrier timed out'); await new Promise(r => setTimeout(r, 5)); } };
  const receipt = { saveName: 'bridge-restart', turn: 40, campaignId: 'bridge_campaign', timelineId: 'tml_bridge_restart', transactionId: 'bridge-transaction', stateChecksum: 'bridge-checksum', data: { context: { shizhengji: 'restart-content' }, refText: 'restart-reference', scenario: { name: 'restart-scenario' } } };
  if (mode === 'restart') {
    await check('canonical-receipt-and-folio-recover-after-real-process-exit', async () => {
      const found = await js(`TM_SaveDB.listTurnPublishReceipts(${JSON.stringify(receipt.campaignId)}, ${JSON.stringify(receipt.timelineId)}, 'world-committed')`);
      assert.equal(found.length, 1, 'committed receipt survives previous Electron process');
      assert.equal((await call('readTurnData', receipt, receipt.turn)).success, false, 'folio still unpublished at restart');
      const result = await js(`(async () => {
        const state = await TM_SaveDB.load('autosave');
        GM = state.gameState.GM; P = state.gameState.P;
        return _recoverPendingTurnDataPublish();
      })()`);
      assert.equal(result.ok, true); assert.equal(result.recovered, 1);
      assert.equal((await call('readTurnData', receipt, receipt.turn)).data.context.shizhengji, 'restart-content');
      assert.equal((await call('publishTurnData', receipt)).success, true, 'same transaction publish remains idempotent');
      assert.equal((await js(`TM_SaveDB.listTurnPublishReceipts(${JSON.stringify(receipt.campaignId)}, ${JSON.stringify(receipt.timelineId)}, 'world-committed')`)).length, 0);
    });
    return;
  }
  const saveDir = path.join(temp, 'saves'); fs.mkdirSync(saveDir, { recursive: true });
  await check('legacy-and-hash-save-real-ipc-roundtrip', async () => {
    const payload = { gameState: { turn: 8, chars: [], _campaignId: 'fixture', _timelineId: 'tml_fixture' }, meta: { v: 'test' } };
    fs.writeFileSync(path.join(saveDir, '旧中文档.json'), JSON.stringify(payload));
    const original = fs.readFileSync(path.join(saveDir, '旧中文档.json'));
    for (const name of ['甲?乙', '甲*乙']) assert.equal((await call('saveProject', name, payload)).success, true);
    const listed = await call('listSaves'); assert.equal(listed.success, true);
    for (const row of listed.files) assert.equal((await call('loadProject', row)).success, true, row.name);
    assert.equal((await call('loadProject', { name: '旧中文档' })).success, true);
    assert.deepEqual(fs.readFileSync(path.join(saveDir, '旧中文档.json')), original, 'legacy read stays read-only');
    const hashed = listed.files.filter(r => r.storageKey.startsWith('save-') || !r.legacy);
    assert.equal(hashed.length, 2); assert.notEqual(hashed[0].storageKey, hashed[1].storageKey);
    assert.equal((await call('deleteSave', hashed[0])).success, true);
    assert.equal((await call('loadProject', hashed[1])).success, true);
    assert.equal((await call('loadProject', { storageKey: '../escape' })).success, false);
  });
  await check('autosave-text-bridge-real-ipc-and-invalid-input-preserves-disk', async () => {
    assert.equal(await js("typeof tianming.autoSaveJson"), 'function');
    const data = { gameState: { turn: 8, _campaignId: 'text_fixture', _timelineId: 'tml_text_fixture', note: '中文 😀 e\u0301' } };
    assert.equal((await call('autoSave', data)).success, true);
    const file = path.join(saveDir, '__autosave__.json');
    const objectEnvelope = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal((await call('autoSaveJson', JSON.stringify(data))).success, true);
    const text = fs.readFileSync(file), envelope = JSON.parse(text.toString('utf8'));
    assert.deepEqual(envelope.data, objectEnvelope.data);
    assert.equal(envelope.sessionToken, objectEnvelope.sessionToken);
    assert.equal(envelope.__tmAutoSaveEnvelope, 1);
    assert(text.toString('utf8').startsWith('{"__tmDesktopSaveGeneration":'));
    for (const invalid of ['{bad', 'null', '[]']) {
      await assert.rejects(call('autoSaveJson', invalid));
      assert.deepEqual(fs.readFileSync(file), text, 'invalid text must not alter the committed file');
    }
  });
  await check('manual-save-world-switch-barrier-and-late-real-ipc', async () => {
    // Controlled world fixtures and timing; actual loaded desktopDoSave, lease,
    // normalization, detached snapshot and immutable preload bridge are untouched.
    await js(`(() => {
      window.__originalFixture = { GM, P, toast, enterGame, _buildSaveState };
      window.__fixtureMessages = []; toast = m => __fixtureMessages.push(m); enterGame = () => __fixtureMessages.push('entered');
      GM = Object.assign({}, GM, { turn: 20, _campaignId: 'bridge_a', _timelineId: 'tml_bridge_a', saveName: 'old-a', running: false });
      P = JSON.parse(JSON.stringify(P)); P.meta = Object.assign({}, P.meta, { v: 'test' });
      const input = document.createElement('input'); input.id = 'save-name-inp'; input.value = 'manual-a'; document.body.appendChild(input);
      window._tmLoadBarrier = new Promise(r => { window.__releaseLoad = r; });
      window.__manual = desktopDoSave();
      GM = Object.assign({}, GM, { _campaignId: 'bridge_b', _timelineId: 'tml_bridge_b', saveName: 'world-b' }); P = JSON.parse(JSON.stringify(P));
      __releaseLoad(true); return true;
    })()`);
    assert.equal(await js('window.__manual'), false);
    assert.equal(await js('GM.saveName'), 'world-b');
    assert.equal((await call('listSaves')).files.some(f => f.name === 'manual-a'), false);
    let release;
    controls.saveGate = new Promise(r => { release = r; }); controls.saveArrived = false;
    try {
      await js(`(() => {
        window._tmLoadBarrier = null; window.__snapshotObservations = [];
        // Observe the actual synchronous builder at its boundary. General event-loop
        // initialization and findScenarioById legitimately populate runtime indices;
        // they are not snapshot normalization. No result or implementation is replaced.
        _buildSaveState = function(...args) {
          const before = JSON.stringify({GM,P});
          const result = Reflect.apply(__originalFixture._buildSaveState, this, args);
          __snapshotObservations.push(before === JSON.stringify({GM,P}));
          return result;
        };
        window.__manual = desktopDoSave(); return true;
      })()`);
      await wait(() => controls.saveArrived);
      assert.deepEqual(await js('__snapshotObservations'), [true], 'actual snapshot builder ran once without mutating live GM/P');
      await js(`GM = Object.assign({}, GM, { _campaignId:'bridge_c', _timelineId:'tml_bridge_c', saveName:'world-c' }); P = JSON.parse(JSON.stringify(P)); true`);
      release(); assert.equal(await js('__manual'), false);
      assert.equal(await js('GM.saveName'), 'world-c'); assert.deepEqual(await js('__fixtureMessages'), []);
      const disk = await call('loadProject', 'manual-a'); assert.equal(disk.success, true);
      assert.equal(disk.data.gameState._campaignId, 'bridge_b');
    } finally {
      release(); controls.saveGate = null;
      await js(`GM = __originalFixture.GM; P = __originalFixture.P; toast = __originalFixture.toast; enterGame = __originalFixture.enterGame; _buildSaveState = __originalFixture._buildSaveState; document.getElementById('save-name-inp').remove(); true`);
    }
  });
  await check('atomic-export-real-ipc-failure-and-cancel', async () => {
    const file = path.join(temp, 'export.json'), old = Buffer.from('{"old":"keep"}');
    controls.saveDialog = { canceled: false, filePath: file };
    assert.equal((await call('dialogExport', { fresh: 1 })).success, true);
    for (const operation of ['writeFileSync', 'fsyncSync', 'renameSync']) {
      fs.writeFileSync(file, old);
      const original = fs[operation];
      fs[operation] = (...args) => {
        // Only failures of the chosen export target; no logging/IndexedDB writes affected.
        const matches = operation === 'renameSync' ? args[1] === file : operation === 'fsyncSync' ? exportFd === args[0] : exportFd === args[0];
        if (matches) { if (operation === 'writeFileSync') fs.writeSync(args[0], Buffer.from('partial')); throw new Error('injected-export-' + operation); }
        return original(...args);
      };
      const open = fs.openSync; let exportFd;
      fs.openSync = (name, ...rest) => { const fd = open(name, ...rest); if (String(name).startsWith(file + '.tmp-')) exportFd = fd; return fd; };
      try { assert.equal((await call('dialogExport', { replacement: 2 })).success, false); }
      finally { fs[operation] = original; fs.openSync = open; }
      assert.deepEqual(fs.readFileSync(file), old);
    }
    assert.equal(fs.readdirSync(temp).some(n => n.startsWith('export.json.tmp-')), false);
    controls.saveDialog = { canceled: true }; assert.equal((await call('dialogExport', { ignored: 1 })).canceled, true); assert.deepEqual(fs.readFileSync(file), old);
    controls.saveDialog = null;
  });
  await check('real-worker-import-cancel-timeout-error-and-recovery', async () => {
    const file = path.join(temp, 'import.json'); fs.writeFileSync(file, JSON.stringify({ marker: 'large-import', padding: 'x'.repeat(8 * 1024 * 1024) }));
    controls.openDialog = { canceled: false, filePaths: [file] };
    const normal = await call('dialogImport'); assert.equal(normal.success, true); assert.equal(normal.data.padding.length, 8 * 1024 * 1024);
    for (const failure of ['cancel', 'timeout', 'crash']) {
      const gate = new SharedArrayBuffer(8); let created = false;
      controls.importOptions = { timeoutMs: failure === 'timeout' ? 25 : 10000,
        workerFactory(entry, opts) { created = true; return new Worker(path.join(__dirname, 'import-worker.cjs'), { ...opts, workerData: { ...opts.workerData, testEntry: entry, testWait: failure === 'crash' ? null : gate, testCrash: failure === 'crash' } }); } };
      await js('window.__importResult = window.tianming.dialogImport(); true'); await wait(() => created);
      if (failure === 'cancel') assert.equal((await call('cancelFileImports')).success, true);
      const result = await js('__importResult'); assert.equal(result.success, false);
      assert.match(result.error, failure === 'cancel' ? /取消/ : failure === 'timeout' ? /超时/ : /injected-real-worker-crash/);
      await wait(() => require(path.join(root, 'main-json-file.js')).importActivity().active === 0);
    }
    controls.importOptions = null; assert.equal((await call('dialogImport')).success, true);
    const geo = path.join(temp, 'map.geojson'); fs.writeFileSync(geo, '{"type":"FeatureCollection","features":[]}');
    controls.openDialog = { canceled: false, filePaths: [geo] }; assert.equal((await call('dialogLoadGeoJSON')).success, true);
    controls.openDialog = null;
  });
  await check('workshop-overwrite-rollback-through-real-ipc', async () => {
    const source = path.join(temp, 'incoming'); fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify({ id: 'bridge-pack', title: 'Bridge', version: 'old', type: 'scenario', entry: 'scenario.json' }));
    fs.writeFileSync(path.join(source, 'scenario.json'), '{"name":"old"}');
    controls.openDialog = { canceled: false, filePaths: [source] };
    assert.equal((await call('importWorkshopPack', false)).success, true);
    const packRoot = path.join(temp, 'content/workshop'), packFile = path.join(packRoot, 'packs/bridge-pack/scenario.json'), index = path.join(packRoot, 'workshop-index.json');
    const oldIndex = fs.readFileSync(index), oldPack = fs.readFileSync(packFile);
    fs.writeFileSync(path.join(source, 'scenario.json'), '{"name":"new"}');
    const copy = fs.copyFileSync;
    fs.copyFileSync = (from, to, ...rest) => { if (String(to).includes('.stage-') && path.basename(to) === 'scenario.json') throw new Error('injected-workshop-copy'); return copy(from, to, ...rest); };
    try { assert.equal((await call('importWorkshopPack', true)).success, false); } finally { fs.copyFileSync = copy; }
    assert.deepEqual(fs.readFileSync(packFile), oldPack); assert.deepEqual(fs.readFileSync(index), oldIndex);
    assert.equal((await call('importWorkshopPack', true)).success, true); assert.equal(JSON.parse(fs.readFileSync(packFile)).name, 'new');
    controls.openDialog = null;
  });
  if (mode === 'production') await check('canonical-world-and-receipt-committed-before-process-exit', async () => {
    assert.equal((await call('stageTurnData', receipt)).success, true);
    const result = await js(`(async () => {
      const marker = ${JSON.stringify(receipt)};
      const state = { GM: { turn: marker.turn, _campaignId: marker.campaignId, _timelineId: marker.timelineId, chars: [] }, P: { meta: { v: 'test' } } };
      return TM_SaveDB.saveManyAtomic([{id:'autosave',gameState:state,meta:{turn:40}}, {id:'slot_0',gameState:state,meta:{turn:40}}], {transactionId: marker.transactionId, turnPublishReceipt: marker});
    })()`);
    assert.equal(result, true); assert.equal((await call('readTurnData', receipt, receipt.turn)).success, false);
  });
};
