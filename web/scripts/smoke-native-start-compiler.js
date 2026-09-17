#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  crypto = require('node:crypto');
const S = require('../tm-start-compiler.js'),
  { fixture } = require('./fixtures/native-start-fixture.cjs');
let pass = 0,
  fail = 0;
async function test(name, fn) {
  try {
    await fn();
    pass++;
    console.log('PASS ' + name);
  } catch (e) {
    fail++;
    console.error('FAIL ' + name + '\n' + e.stack);
  }
}
const source = (f) => S.createSource(f.scenario, { capabilities: f.capabilities });
const options = (f) => ({ sessionId: 'test-session', resolveMapAsset: f.resolveMapAsset });
const expectCode = (code) => (error) => error.code === code;
const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
(async () => {
  await test('source hash describes the exact locked bytes, including mutation during async digest', async () => {
    const f = fixture(),
      text = JSON.stringify(f.scenario),
      promise = source(f);
    f.scenario.id = 'late-author-edit';
    f.scenario.characters[1].name = '修改后的姓名';
    f.scenario.nativeStart.accounts[1].balance = 999;
    const h = await promise;
    assert.equal(h.sourceScenarioId, 'synthetic-world');
    assert.equal(h.byteLength, Buffer.byteLength(text));
    assert.equal(h.hash, crypto.createHash('sha256').update(text).digest('hex'));
    assert(Object.isFrozen(h.catalog));
    const c = await S.compile(h, 'pb', options(f));
    assert.equal(c.character.name, '同名君主');
    assert.equal(c.playerView.accounts[0].balance, 7);
  });
  await test('repeated search and profile preview do not clone a single world', async () => {
    const f = fixture(),
      h = await source(f);
    for (let i = 0; i < 100; i++) {
      assert.equal(S.previews(h, '乙公国').length, 3);
      assert.equal(S.previews(h, 'ca').length, 1);
    }
    assert.equal(S.stats(h).cloneCount, 0);
    assert.equal(S.previews(h, '不存在').length, 0);
    assert.throws(() => {
      h.catalog.profiles[0].summary.characterName = 'forged';
    }, TypeError);
    await S.compile(h, 'pb', options(f));
    assert.equal(S.stats(h).cloneCount, 1);
  });
  await test('candidate preserves all foreign data, sid/name, families and original character details', async () => {
    const f = fixture(),
      original = JSON.stringify(f.scenario),
      c = await S.compile(await source(f), 'pb', options(f));
    assert.equal(c.status, 'prepared-not-started');
    assert.equal(c.scenario.id, f.scenario.id);
    assert.equal(c.scenario.name, f.scenario.name);
    assert.equal(c.worldRegistry.characters.length, 5);
    assert.equal(c.worldRegistry.factions.length, 3);
    assert.equal(c.worldRegistry.armies.length, 2);
    assert.equal(c.worldRegistry.classes.length, 2);
    assert.equal(c.worldRegistry.parties.length, 2);
    assert.equal(c.worldRegistry.events.length, 3);
    assert.deepEqual(c.scenario.families, f.scenario.families);
    assert.deepEqual(c.character.secrets, ['合成秘密']);
    assert.equal(c.character.health.vigor, 71);
    assert.deepEqual(c.scenario.characters[0].relationships, f.scenario.characters[0].relationships);
    assert.equal(JSON.stringify(f.scenario), original);
    assert.equal(c.scenario.factions.filter((f) => f.isPlayer).length, 1);
    assert.equal(c.scenario.characters.filter((c) => c.isPlayer).length, 1);
    assert.equal(c.scenario.characters.find((c) => c.isPlayer).id, 'cb');
    assert.equal(c.faction.leaderCharacterId, 'cb');
  });
  await test('player views share authoritative candidate objects; identical foreign names remain independent', async () => {
    const f = fixture(),
      c = await S.compile(await source(f), 'pb', options(f));
    assert.strictEqual(c.worldRegistry.classes, c.scenario.classes);
    assert.strictEqual(c.playerView.classes[0], c.worldRegistry.classes[1]);
    assert.strictEqual(c.playerView.parties[0], c.worldRegistry.parties[1]);
    assert.strictEqual(c.playerView.accounts[0], c.scenario.nativeStart.accounts[1]);
    assert.strictEqual(c.playerView.openingEvents[0], c.worldRegistry.events[1]);
    c.playerView.classes[0].satisfaction = 5;
    assert.equal(c.scenario.classes[1].satisfaction, 5);
    assert.equal(c.scenario.classes[0].satisfaction, 30);
    assert.equal(f.scenario.classes[1].satisfaction, 70);
  });
  await test('identity is derived from authoritative selected records, never stale playerInfo or title labels', async () => {
    const f = fixture(),
      c = await S.compile(await source(f), 'pr', options(f));
    assert.equal(c.scenario.playerInfo.characterId, 'cr');
    assert.equal(c.scenario.playerInfo.characterBio, '角色履历');
    assert.equal(c.scenario.playerInfo.factionName, '乙国');
    assert.equal(c.scenario.playerInfo.leaderIsPlayer, false);
    assert.equal(c.scenario.playerInfo.characterTitle, '议事代表');
    assert.equal(c.faction.leaderCharacterId, 'cb');
    assert.deepEqual(c.authority.grants, ['diplomacy']);
    assert.equal(c.startContext.roleKind, 'delegatedRepresentative');
  });
  await test('opening and candidate context share the same immutable source, selected rules and zero account', async () => {
    const f = fixture();
    f.scenario.nativeStart.profiles[0].initialStateOverrides = { openingText: '', startPressure: '零库需筹措' };
    const h = await source(f),
      c = await S.compile(h, 'pa', options(f));
    assert.equal(c.scenario.opening, '');
    assert.equal(c.summary.accounts[0].balance, 0);
    assert.equal(c.playerView.accounts[0].balance, 0);
    assert.strictEqual(c.scenario.startContext, c.startContext);
    assert.equal(c.startContext.sourceScenarioHash, h.hash);
    assert.equal(
      c.startContext.rulesetHash,
      crypto.createHash('sha256').update(JSON.stringify(c.ruleset)).digest('hex'),
    );
    assert.equal(c.startContext.startRegionId, 'ra');
    assert.equal(c.startContext.playerCharacterId, 'ca');
    assert.equal(c.startContext.playerFactionId, 'fa');
  });
  await test('missing/disabled profile rejects before any clone or asset read', async () => {
    const f = fixture();
    let reads = 0;
    const h = await source(f);
    await assert.rejects(
      S.compile(h, 'missing', {
        sessionId: 'test-session',
        resolveMapAsset: () => {
          reads++;
        },
      }),
      expectCode('profile-disabled'),
    );
    assert.equal(reads, 0);
    assert.equal(S.stats(h).cloneCount, 0);
    const g = fixture(),
      unsupported = await S.createSource(g.scenario);
    await assert.rejects(S.compile(unsupported, 'pb', options(g)), expectCode('profile-disabled'));
    assert.equal(S.stats(unsupported).cloneCount, 0);
  });
  await test('asset missing, wrong size or wrong hash cannot silently load a different map', async () => {
    for (const [resolver, code] of [
      [undefined, 'map-asset-unavailable'],
      [async () => new Uint8Array(1), 'map-asset-size'],
      [async () => ({ contentHash: 'claimed' }), 'map-asset-bytes'],
    ]) {
      const f = fixture();
      await assert.rejects(
        S.compile(await source(f), 'pb', { sessionId: 'test-session', resolveMapAsset: resolver }),
        expectCode(code),
      );
    }
    const f = fixture(),
      bad = f.bytes.slice();
    bad[10] ^= 1;
    await assert.rejects(
      S.compile(await source(f), 'pb', { sessionId: 'test-session', resolveMapAsset: async () => bad }),
      expectCode('map-asset-hash'),
    );
  });
  await test('matching bytes are still checked for map ID, version, coordinate system and logical coverage', async () => {
    const signed = (f) => {
      f.bytes = new TextEncoder().encode(JSON.stringify(f.map));
      f.scenario.nativeStart.mapRef.byteLength = f.bytes.byteLength;
      f.scenario.nativeStart.mapRef.contentHash = crypto.createHash('sha256').update(f.bytes).digest('hex');
      f.resolveMapAsset = async () => f.bytes;
    };
    for (const key of ['id', 'version', 'coordinateSystemId', 'schemaVersion']) {
      const f = fixture();
      f.map[key] = 'wrong';
      signed(f);
      await assert.rejects(S.compile(await source(f), 'pb', options(f)), expectCode('map-asset-contract'));
    }
    const f = fixture();
    f.map.cells[2].id = 'another-island';
    signed(f);
    await assert.rejects(S.compile(await source(f), 'pb', options(f)), expectCode('map-binding-coverage'));
    const g = fixture();
    g.map.cells[2].id = 'rb';
    signed(g);
    await assert.rejects(S.compile(await source(g), 'pb', options(g)), expectCode('map-asset-region-id'));
  });
  await test('verified map receipt is truthful about geometry still requiring real validation', async () => {
    const f = fixture(),
      c = await S.compile(await source(f), 'pb', options(f));
    assert(c.mapProof.verified);
    assert.equal(c.mapProof.geometryValidated, true);
    assert.equal(c.mapProof.geometryWitness.regions, 3);
    assert.equal(Object.keys(c.mapProof.ids).length, 3);
    assert(c.diagnostics.some((d) => d.code === 'geometry-validated'));
    assert.equal(c.mapProof.ref.contentHash, f.scenario.nativeStart.mapRef.contentHash);
  });
  await test('double confirmation cannot prepare a second candidate during or after compilation', async () => {
    const f = fixture(),
      h = await source(f),
      gate = defer(),
      first = S.compile(h, 'pb', { sessionId: 'one', resolveMapAsset: async () => gate.promise });
    await assert.rejects(S.compile(h, 'pa', options(f)), expectCode('start-reentry'));
    gate.resolve(f.bytes);
    await first;
    await assert.rejects(S.compile(h, 'pa', options(f)), expectCode('start-reentry'));
    assert.equal(S.stats(h).cloneCount, 1);
  });
  await test('cancel or superseded source rejects late asset completion without returning a candidate', async () => {
    for (const cancelViaSignal of [false, true]) {
      const f = fixture(),
        h = await source(f),
        gate = defer(),
        controller = new AbortController();
      const pending = S.compile(h, 'pb', {
        sessionId: 'one',
        signal: controller.signal,
        resolveMapAsset: async () => gate.promise,
      });
      if (cancelViaSignal) controller.abort();
      else {
        assert(S.cancel(h));
        assert.equal(S.cancel(h), false);
      }
      gate.resolve(f.bytes);
      await assert.rejects(pending, expectCode('start-cancelled'));
    }
  });
  await test('forged handles, cancelled sources and missing session IDs fail closed', async () => {
    const f = fixture(),
      h = await source(f);
    await assert.rejects(S.compile({ ...h }, 'pb', options(f)), expectCode('source-expired'));
    await assert.rejects(S.compile(h, 'pb', { resolveMapAsset: f.resolveMapAsset }), expectCode('session-id'));
    S.cancel(h);
    assert.throws(() => S.previews(h), expectCode('source-expired'));
  });
  await test('abort promptly releases a hung asset reader; deadline is enforced even if the reader ignores cancellation', async () => {
    const f = fixture(),
      h = await source(f),
      ctrl = new AbortController(),
      never = () => new Promise(() => {});
    const pending = S.compile(h, 'pb', { sessionId: 'test-session', signal: ctrl.signal, resolveMapAsset: never });
    ctrl.abort();
    await assert.rejects(pending, expectCode('start-cancelled'));
    assert.equal(S.stats(h).compiling, false);
    await assert.rejects(
      S.compile(h, 'pb', { sessionId: 'test-session', timeoutMs: 10, resolveMapAsset: never }),
      expectCode('start-prepare-timeout'),
    );
    assert.equal(S.stats(h).compiled, false);
    await assert.rejects(S.compile(h, 'pb', { ...options(f), timeoutMs: 30001 }), expectCode('prepare-timeout-budget'));
    const next = S.compile(h, 'pb', { ...options(f), resolveMapAsset: never });
    S.cancel(h);
    await assert.rejects(next, expectCode('start-cancelled'));
  });
  await test('pure-data validation rejects unsafe prototype fields, getters, cycles and lossy JSON without executing them', async () => {
    let called = 0;
    const getter = {};
    Object.defineProperty(getter, 'name', {
      enumerable: true,
      get() {
        called++;
        return 'bad';
      },
    });
    const inherited = Object.create({
      toJSON() {
        called++;
        return {};
      },
    });
    const cycle = {};
    cycle.self = cycle;
    const values = [
      getter,
      inherited,
      cycle,
      new Date(),
      { n: NaN },
      { n: undefined },
      { f() {} },
      { [Symbol('s')]: 1 },
      [, 1],
      JSON.parse('{"__proto__":{}}'),
      { deep: { constructor: 'bad' } },
    ];
    for (const value of values) await assert.rejects(S.createSource(value));
    assert.equal(called, 0);
  });
  await test('cancelled request and explicit size budgets fail without claiming a prepared source', async () => {
    const f = fixture(),
      ctrl = new AbortController();
    ctrl.abort();
    await assert.rejects(S.createSource(f.scenario, { signal: ctrl.signal }), expectCode('start-cancelled'));
    await assert.rejects(S.createSource(f.scenario, { maxBytes: 100 }), expectCode('source-size'));
    await assert.rejects(S.createSource(f.scenario, { maxBytes: S.maxBytes + 1 }), expectCode('source-budget'));
  });
  await test('no live world, localStorage, IndexedDB or fetch is accessed during detached preparation', async () => {
    const keys = ['GM', 'P', 'localStorage', 'indexedDB', 'fetch'],
      prior = keys.map((k) => Object.getOwnPropertyDescriptor(globalThis, k));
    try {
      keys.forEach((k) =>
        Object.defineProperty(globalThis, k, {
          configurable: true,
          get() {
            throw Error('forbidden access: ' + k);
          },
        }),
      );
      const f = fixture(),
        c = await S.compile(await source(f), 'pb', options(f));
      assert.equal(c.status, 'prepared-not-started');
    } finally {
      keys.forEach((k, i) => {
        if (prior[i]) Object.defineProperty(globalThis, k, prior[i]);
        else delete globalThis[k];
      });
    }
  });
  await test('legacy adapter cannot be used to reinitialize a saved/current world', async () => {
    const f = fixture();
    delete f.scenario.nativeStart;
    f.scenario.playerInfo.characterId = 'ca';
    const h = await source(f);
    assert.equal(h.catalog.mode, 'legacy');
    await assert.rejects(S.compile(h, h.catalog.profiles[0].id, options(f)), expectCode('legacy-entry'));
    assert.equal(S.stats(h).cloneCount, 0);
  });
  await test('classic browser scripts expose the same pure APIs without CommonJS or Node privileges', async () => {
    const context = vm.createContext({
      TextEncoder,
      TextDecoder,
      crypto: crypto.webcrypto,
      console,
      setTimeout,
      clearTimeout,
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../tm-start-contracts.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../tm-start-compiler.js'), 'utf8'), context);
    const f = fixture();
    context.input = JSON.stringify(f.scenario);
    const handle = await vm.runInContext(
      'TM.StartCompiler.createSource(JSON.parse(input), {capabilities:["test-native-v1"]})',
      context,
    );
    assert.equal(handle.catalog.profiles.filter((p) => p.enabled).length, 4);
    assert.equal(handle.hash, crypto.createHash('sha256').update(context.input).digest('hex'));
    assert.equal(vm.runInContext('typeof require', context), 'undefined');
  });
  console.log(`native-start-compiler: ${pass} PASS / ${fail} FAIL`);
  if (fail) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
