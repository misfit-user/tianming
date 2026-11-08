'use strict';
// Compatibility checks only. No browser UI or endTurn claim is made here.
// Reuse the repository's complete headless startup harness, then execute the
// actual lazy loader, synchronous startup, save builder and restore-fields.
// The repository headless harness has no IndexedDB, so this is deliberately
// not formal persistence, fullLoadGame, UI or top-level endTurn acceptance.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), cp = require('node:child_process');
const { createRequire } = require('node:module');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'web');
const outputIndex = process.argv.indexOf('--output-dir');
if (outputIndex >= 0 && (!process.argv[outputIndex + 1] || process.argv[outputIndex + 1].startsWith('--'))) throw Error('--output-dir requires a path');
const outputDir = outputIndex < 0 ? __dirname : path.resolve(process.argv[outputIndex + 1]);
fs.mkdirSync(outputDir, { recursive: true });
const cases = { tianqi: 'sc-tianqi7-1627', tang: 'sc-tang840-840', shaosong: 'sc-jianyan1-1127-shaosong' };
const which = process.argv[process.argv.indexOf('--case') + 1];
if (!Object.hasOwn(cases, which)) {
  const reports = [];
  for (const key of ['tianqi', 'tang']) {
    const run = cp.spawnSync(process.execPath, ['--expose-gc', __filename, '--case', key, '--output-dir', outputDir], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 150000 });
    const lines = String(run.stdout || '').split(/\r?\n/), line = lines.findLast(x => x.startsWith('OFFICIAL_COMPAT '));
    fs.writeFileSync(path.join(outputDir, 'official-compat-' + key + '.log'), String(run.stdout || '') + String(run.stderr || ''));
    assert.equal(run.status, 0, key + ': ' + String(run.stderr || run.error || '').slice(-2500));
    assert(line, key + ' produced no checked report'); reports.push(JSON.parse(line.slice('OFFICIAL_COMPAT '.length)));
  }
  const evidence = { kind: 'official-load-location-duty-save-compatibility', testedHead: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    boundary: 'Headless synchronous production startup plus save-builder/restore-fields only; no IndexedDB, fullLoadGame, Electron buttons, complete meeting or 30-day-world claim for these two scenarios.', reports };
  fs.writeFileSync(path.join(outputDir, 'official-compatibility.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
} else {
  const harness = path.join(web, 'scripts/smoke-start-game-data-integrity.js');
  const text = fs.readFileSync(harness, 'utf8').replace(/^#![^\n]*\n/, ''), end = text.indexOf('(async function main()');
  assert(end > 0);
  const helper = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', text.slice(0, end) + '\nreturn {loadGame,compiledScripts,dispose:()=>disposeGame()};')(createRequire(harness), process, path.dirname(harness), harness, { exports: {} }, {});
  async function run() {
    const start = performance.now(), c = helper.loadGame(null), modelAttempts = [], scriptLoads = [];
    // Main caches vm.Script directly; its key identifies the exact frozen source file.
    // Hash the file bytes, not a removed .source field or reconstructed JavaScript.
    const runtimeFiles = Array.from(helper.compiledScripts, ([file, compiled]) => {
      assert(compiled instanceof vm.Script, 'compiled cache entry must be an actual vm.Script: ' + file);
      const absolute = path.resolve(web, file);
      assert(absolute.startsWith(web + path.sep) && fs.statSync(absolute).isFile(), 'compiled cache key must identify an existing runtime file: ' + file);
      return { file: 'web/' + file, sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') };
    }).sort((a, b) => a.file.localeCompare(b.file));
    const runtimeIdentity = { files: runtimeFiles.length, sha256: crypto.createHash('sha256').update(JSON.stringify(runtimeFiles)).digest('hex') };
    fs.writeFileSync(path.join(outputDir, 'official-runtime-' + which + '.json'), JSON.stringify({ ...runtimeIdentity, runtimeFiles }, null, 2) + '\n');
    c.P.ai = { key: '', url: '', model: '' };
    for (const name of ['callAI', 'callAISmart', 'callAIMessages', 'callAIWithTools', 'callAIMessagesStream']) c[name] = async () => { modelAttempts.push(name); throw Error('compatibility-model-call-forbidden:' + name); };
    // Browser resource acquisition is replaced by reads of the same checked-in
    // bytes. Every loaded scenario is matched against its manifest hash.
    c.fetch = async resource => {
      const url = new URL(String(resource), 'http://localhost/index.html');
      if (url.origin !== 'http://localhost') throw Error('external-resource-forbidden:' + url.origin);
      const file = path.resolve(web, '.' + decodeURIComponent(url.pathname));
      assert(file.startsWith(web + path.sep));
      const data = fs.readFileSync(file);
      return { ok: true, status: 200, headers: { get() { return 'application/json'; } }, text: async () => data.toString('utf8'), json: async () => JSON.parse(data.toString('utf8')), arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
    };
    const append = c.document.head.appendChild.bind(c.document.head);
    c.document.head.appendChild = node => {
      if (!node.src || !String(node.src).includes('scenarios/')) return append(node);
      const relative = new URL(node.src, 'http://localhost/index.html').pathname.replace(/^\//, ''), entry = c.TMOfficialScenarioManifest.entries.find(e => e.scriptUrl === relative);
      assert(entry, 'unlisted official script'); const data = fs.readFileSync(path.join(web, relative));
      assert.equal(crypto.createHash('sha256').update(data).digest('hex'), entry.sha256); assert.equal(data.length, entry.bytes);
      scriptLoads.push({ relative, sha256: entry.sha256, bytes: data.length });
      queueMicrotask(() => { try { vm.runInContext(data.toString('utf8'), c, { filename: relative, timeout: 30000 }); if (node.onload) node.onload(); } catch (e) { if (node.onerror) node.onerror(e); else throw e; } });
      return node;
    };
    await c.TMOfficialScenarioLoader.ready();
    const source = await c.TMOfficialScenarioLoader.ensure(cases[which]);
    assert.equal(scriptLoads.length, 1); assert.equal(source._lazyOfficial, undefined);
    const expected = { people: source.characters.length, factions: source.factions.length, regions: (source.mapData || source.map).regions.length };
    c.doActualStart(source.id);
    assert.equal(c.GM.sid, source.id); assert(c.GM.chars.length >= expected.people, 'normal population retained');
    assert(c.GM.facs.length >= expected.factions); assert.equal(c.GM.mapData.regions.length, expected.regions);
    const D = c.TM.NPC.DailyActivities, O = c.TM.OfficeTenure, L = c.TM.NPC.ActionLedger;
    assert(D && O && L && c.TM.NPC.Meetings && c.TM.NPC.LocalAI);
    const people = c.GM.chars, locations = people.map(ch => ({ id: ch.id, location: D.exactLocation(ch, c.GM) })).filter(r => r.location);
    assert(locations.length > 0); assert.equal(new Set(people.map(ch => String(ch.id))).size, people.length);
    if (which === 'shaosong') {
      const player = people.find(ch => D.controlled(ch)); assert(player, 'actual common controller identifies player');
      const known = Array.from(D.knownIds(player), key => D.person(key)).filter(Boolean).map(ch => ({ id: ch.id, name: ch.name, location: D.exactLocation(ch), sourceLocation: ch.location, relation: player.relations && player.relations[ch.name], canDeliver: D.canDeliver(player, ch) }));
      const withoutScenarioRelationReader = Array.from(D.knownIds({ ...player, relations: {} }), key => D.person(key)).filter(Boolean).map(ch => ({ id: ch.id, name: ch.name, location: D.exactLocation(ch), canDeliver: D.canDeliver(player, ch) }));
      const materials = D.materialOptions(player, c.GM);
      console.log('INITIAL_SHAOSONG ' + JSON.stringify({ runtimeIdentity, playerId: player.id, playerName: player.name, playerLocation: D.exactLocation(player), withoutScenarioRelationReader, known, materialOptions: materials, relationCount: Object.keys(player.relations || {}).length, exactLocations: locations.length, modelAttempts: modelAttempts.length }));
      return;
    }
    const pairs = [];
    for (const actor of people) {
      if (!actor || actor.alive === false || D.controlled(actor) || !D.exactLocation(actor)) continue;
      for (const targetId of D.knownIds(actor)) {
        const target = D.person(targetId);
        if (target && target !== actor && target.alive !== false && !D.controlled(target) && D.exactLocation(target) === D.exactLocation(actor)) { pairs.push({ actor, target }); break; }
      }
      if (pairs.length >= 3) break;
    }
    assert(pairs.length, 'source-defined contact/location must provide at least one local pair');
    const { actor, target } = pairs[0], originalIds = people.map(ch => ch.id), physicalBefore = people.map(ch => [ch.id, ch.location, ch.regionId]);
    const duties = O.privateTravelDuties(c.GM, actor); assert.equal(duties.status, 'resolved');
    const location = D.exactLocation(actor), route = c.TM.MapRouteDays.planRoute(c.GM.mapData, location, location);
    assert.equal(route.status, 'reachable'); assert.equal(route.days, 0);
    const requestInput = { actionId: 'official-compat:' + source.id, activityKind: 'greeting', targetId: target.id };
    const request = D.submitNPC(actor, requestInput); assert.equal(request.outcome, 'submitted', request.reason);
    const p = D.get(request.planId); assert(p && p.messages.length > 0);
    assert.equal(people.length, originalIds.length); assert.deepEqual(people.map(ch => [ch.id, ch.location, ch.regionId]), physicalBefore);
    // A real first action may materialize canonical IDs on legacy posts.
    // The restore contract compares the state actually written to the save.
    const savedDuties = JSON.parse(JSON.stringify(O.privateTravelDuties(c.GM, actor)));
    const beforeLease = L.capture(), beforeWorld = c.GM;
    const snapshot = c._buildSaveState({ format: 'idb', prepare: false, detach: true });
    const encoded = JSON.stringify({ gameState: snapshot });
    c.GM = JSON.parse(encoded).gameState.GM; c._restoreSavedFields({});
    assert.notEqual(c.GM, beforeWorld); assert.equal(L.current(beforeLease), false);
    assert.equal(c.GM.sid, source.id); assert.deepEqual(Array.from(c.GM.chars, ch => ch.id), Array.from(originalIds));
    assert.equal(c.GM.mapData.regions.length, expected.regions);
    const restored = D.get(p.id); assert(restored && restored.messages.length === p.messages.length);
    const receiptCount = Object.keys(L.state(c.GM).receipts).length;
    const replay = D.submitNPC(D.person(actor.id), requestInput); assert.equal(replay.outcome, request.outcome);
    assert.equal(Object.keys(L.state(c.GM).receipts).length, receiptCount); assert.equal(D.plans().filter(x => x.id === p.id).length, 1);
    const restoredDuties = JSON.parse(JSON.stringify(O.privateTravelDuties(c.GM, D.person(actor.id))));
    assert.equal(restoredDuties.status, savedDuties.status); assert.equal(restoredDuties.rows.length, savedDuties.rows.length);
    const migratedPostIds = [];
    restoredDuties.rows.forEach((row, i) => {
      const before = savedDuties.rows[i], compared = { ...row };
      if (!before.positionId && row.positionId) { migratedPostIds.push(row.positionId); compared.positionId = before.positionId; }
      assert.deepEqual(compared, before, 'restore retains each duty; only formerly absent canonical post IDs may be materialized');
    });
    c._restoreSavedFields({});
    assert.deepEqual(JSON.parse(JSON.stringify(O.privateTravelDuties(c.GM, D.person(actor.id)))), restoredDuties, 'post identity migration is stable when restore repeats');
    assert.equal(modelAttempts.length, 0);
    console.log('OFFICIAL_COMPAT ' + JSON.stringify({ runtimeIdentity, scenarioId: source.id, scenarioName: source.name, scriptLoads, expected,
      loaded: { people: c.GM.chars.length, factions: c.GM.facs.length, regions: c.GM.mapData.regions.length, exactLocations: locations.length },
      pair: { actorId: actor.id, actorName: actor.name, targetId: target.id, targetName: target.name, location },
      duties: restoredDuties, migratedPostIds, activity: { id: p.id, kind: 'greeting', status: restored.status, messages: restored.messages.map(m => ({ id: m.id, status: m.status, toId: m.toId })) },
      save: { format: 'idb-snapshot-schema', bytes: Buffer.byteLength(encoded), restore: '_buildSaveState + JSON transport + _restoreSavedFields', worldReplaced: true, staleLeaseRejected: true, replayReceiptsUnchanged: true, formalPersistence: false },
      modelAttempts: 0, elapsedMs: Math.round(performance.now() - start), scope: 'headless official lazy-load/synchronous-start/location/tenure/activity-entry/save-builder/restore-fields compatibility; no IndexedDB, fullLoadGame, formal UI, top-level endTurn or full composite claim' }));
  }
  run().then(() => helper.dispose()).catch(e => { console.error(e.stack); helper.dispose(); process.exitCode = 1; });
}
