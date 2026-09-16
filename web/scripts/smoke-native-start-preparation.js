#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path');
const S = require('../tm-start-compiler.js'),
  D = require('../tm-start-preparation-document.js');
const { fixture, harness, scenario, sha } = require('./fixtures/native-preparation-harness.cjs');
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
const options = (extra) => ({
  expectedIdentity: { scenarioId: 'source', characterId: 'player' },
  timeoutMs: 500,
  ...extra,
});
const code = (expected) => (e) => e.code === expected;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await test('actual generator is deterministic, byte-pinned and carries only local native resources', async () => {
    const { build } = require('../../scripts/build-native-preparation-manifest.cjs'),
      root = path.resolve(__dirname, '../..');
    const a = build(root),
      b = build(root);
    assert.deepEqual(a, b);
    assert(!JSON.stringify(a).includes(root));
    assert.equal(
      fs.readFileSync(path.join(root, 'web/tm-start-runtime-manifest.json'), 'utf8'),
      JSON.stringify(a) + '\n',
      'the checked-in manifest must match all current native inputs',
    );
    const rows = await D.validate(a, S);
    assert(rows.length > 400);
    assert(a.scripts.some((r) => r.file === 'tm-start-preparation-runtime.js'));
    for (const r of rows) {
      const bytes = fs.readFileSync(path.join(root, 'web', r.file));
      assert.equal(sha(bytes), r.sha256);
      assert.equal(bytes.length, r.byteLength);
    }
  });
  await test('manifest rejects path escapes, remote/encoded paths, conflicting versions, altered hash and embedded scripts', async () => {
    for (const file of [
      '../escape.js',
      'https://evil.example/a.js',
      'core//a.js',
      'core/%2e%2e/a.js',
      'core\\evil.js',
    ]) {
      const f = fixture();
      f.manifest.scripts[0].file = f.manifest.scripts[0].request = file;
      await assert.rejects(D.validate(f.manifest, S), code('runtime-resource-path'));
    }
    const f = fixture();
    f.manifest.scripts.push({ ...f.manifest.scripts[0], sha256: 'f'.repeat(64) });
    await assert.rejects(D.validate(f.manifest, S), code('runtime-resource-conflict'));
    const g = fixture();
    g.manifest.indexHash = 'f'.repeat(64);
    await assert.rejects(D.validate(g.manifest, S), code('runtime-manifest-hash'));
    const h = fixture();
    h.manifest.template += '<script>alert(1)</script>';
    await assert.rejects(D.validate(h.manifest, S), code('runtime-template'));
  });
  await test('document requires fresh bounded nonce/session and contains exactly one nonced bootstrap script', () => {
    const f = fixture(),
      cfg = {
        nonce: 'a'.repeat(48),
        token: 'b'.repeat(48),
        requestId: 'c'.repeat(48),
        runtimeHash: f.manifest.runtimeHash,
      };
    const html = D.create(f.manifest, new Map([['core.js', '/* </script><script>untrusted()</script> */']]), cfg);
    assert.equal((html.match(/<script\b/g) || []).length, 1);
    assert.equal((html.match(/<\/script>/g) || []).length, 1);
    assert(html.includes("connect-src 'none'"));
    assert(!/script-src[^;]*unsafe-(?:eval|inline)/.test(html));
    assert.throws(() => D.create(f.manifest, new Map(), { ...cfg, nonce: 'bad' }), code('runtime-session'));
  });
  await test('one-shot service hashes actual returned bytes and cleans all frames, listeners and active state', async () => {
    const h = harness(),
      input = scenario(),
      before = JSON.stringify(input);
    try {
      const r = await h.api.prepare(input, options());
      assert.equal(r.status, 'initialized-not-committed');
      assert.equal(r.sourceHash, sha(before));
      assert.equal(r.snapshotHash, sha(r.snapshotText));
      assert.equal(r.byteLength, Buffer.byteLength(r.snapshotText));
      assert.equal(r.hashAuthority, 'parent-webcrypto-readback');
      assert.equal(h.state.initCount, 1);
      assert.equal(JSON.stringify(input), before);
      assert.equal(h.state.frames.length, 0);
      assert.equal(h.listeners.size, 0);
      assert.equal(h.api.status().phase, 'idle');
      assert(
        h.state.calls.every(
          (r) => r.config.credentials === 'omit' && r.config.redirect === 'error' && r.config.mode === 'same-origin',
        ),
      );
    } finally {
      h.dispose();
    }
  });
  await test('reentry and pre-aborted input never allocate another preparation or touch storage', async () => {
    const h = harness({ initialize() {} }),
      abort = new AbortController();
    try {
      const pending = h.api.prepare(scenario(), options({ signal: abort.signal })).catch((e) => e.code);
      await assert.rejects(h.api.prepare(scenario(), options()), code('native-preparation-busy'));
      abort.abort();
      assert.equal(await pending, 'start-cancelled');
      const calls = h.state.calls.length;
      await assert.rejects(h.api.prepare(scenario(), options({ signal: abort.signal })), code('start-cancelled'));
      assert.equal(h.state.calls.length, calls);
      assert.equal(h.state.frames.length, 0);
      assert.equal(h.listeners.size, 0);
    } finally {
      h.dispose();
    }
  });
  await test('timeout covers a hung fetch and body stream, not only headers', async () => {
    for (const fetch of [() => new Promise(() => {}), () => new Response(new ReadableStream({ start() {} }))]) {
      const h = harness({ fetch });
      try {
        await assert.rejects(h.api.prepare(scenario(), options({ timeoutMs: 15 })), code('start-prepare-timeout'));
        assert.equal(h.api.status().phase, 'idle');
      } finally {
        h.dispose();
      }
    }
  });
  await test('duplicate script loading preserves the same active owner and cancel handle', async () => {
    const h = harness({ initialize() {} });
    try {
      const api = h.api,
        pending = api.prepare(scenario(), options()).catch((e) => e.code);
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../tm-start-preparation.js'), 'utf8'), h.context);
      assert.strictEqual(h.context.TM.StartPreparation, api);
      assert.equal(h.context.TM.StartPreparation.cancel(), true);
      assert.equal(await pending, 'start-cancelled');
      assert.equal(h.listeners.size, 0);
    } finally {
      h.dispose();
    }
  });
  await test('actual resource size budget and malformed runtime/identity fields fail before native execution', async () => {
    const h = harness();
    h.state.resources.files.set('core.js', 'x'.repeat(h.state.resources.manifest.scripts[0].byteLength + 1));
    try {
      await assert.rejects(h.api.prepare(scenario(), options()), code('runtime-resource-size'));
      assert.equal(h.state.initCount, 0);
    } finally {
      h.dispose();
    }
    const f = fixture();
    delete f.manifest.scripts[0].file;
    await assert.rejects(D.validate(f.manifest, S), code('runtime-resource-path'));
    const g = harness();
    try {
      await assert.rejects(g.api.prepare(scenario(), options({ timeoutMs: 60001 })), code('native-preparation-budget'));
      await assert.rejects(
        g.api.prepare(scenario(), options({ expectedIdentity: { scenarioId: 'source', characterId: 'missing' } })),
        code('native-preparation-identity'),
      );
      assert.equal(g.state.calls.length, 0);
    } finally {
      g.dispose();
    }
  });
  await test('partial HTTP response and bytes inconsistent with the pinned native resource fail closed', async () => {
    const partial = harness({ fetch: () => new Response('partial', { status: 206 }) });
    try {
      await assert.rejects(partial.api.prepare(scenario(), options()), code('runtime-resource-read'));
    } finally {
      partial.dispose();
    }
    const h = harness();
    h.state.resources.files.set('core.js', 'a'.repeat(h.state.resources.manifest.scripts[0].byteLength));
    try {
      await assert.rejects(h.api.prepare(scenario(), options()), code('runtime-resource-hash'));
      assert.equal(h.state.initCount, 0);
    } finally {
      h.dispose();
    }
  });
  await test('unexpected parent-window identity, origin or token cannot open the private port', async () => {
    for (const transform of [
      (event) => ({ ...event, source: {} }),
      (event) => ({ ...event, origin: 'https://evil.example' }),
      (event) => ({ ...event, data: { ...event.data, token: 'wrong' } }),
    ]) {
      const h = harness({
        ready({ event, listeners }) {
          listeners.forEach((fn) => fn(transform(event)));
        },
      });
      try {
        await assert.rejects(h.api.prepare(scenario(), options({ timeoutMs: 25 })), code('start-prepare-timeout'));
        assert.equal(h.state.initCount, 0);
        assert.equal(h.listeners.size, 0);
      } finally {
        h.dispose();
      }
    }
  });
  await test('stale result/session cannot finish, and source/identity mismatch is rejected', async () => {
    for (const item of [{ token: 'wrong' }, { requestId: 'wrong' }, { runtimeHash: 'wrong' }]) {
      const h = harness({
        initialize({ reply }) {
          reply(item);
        },
      });
      try {
        await assert.rejects(h.api.prepare(scenario(), options({ timeoutMs: 30 })), code('start-prepare-timeout'));
      } finally {
        h.dispose();
      }
    }
    const h = harness({
      initialize({ reply }) {
        reply({ sourceHash: 'f'.repeat(64) });
      },
    });
    try {
      await assert.rejects(h.api.prepare(scenario(), options()), code('native-result-contract'));
    } finally {
      h.dispose();
    }
    const g = harness({
      initialize({ reply }) {
        reply({
          bytes: new TextEncoder().encode(
            JSON.stringify({ P: {}, GM: { sid: 'source', playerCharacterId: 'another', running: true } }),
          ).buffer,
        });
      },
    });
    try {
      await assert.rejects(g.api.prepare(scenario(), options()), code('native-result-identity'));
    } finally {
      g.dispose();
    }
  });
  await test('cancel while verifying ignores late digest and a cancelled operation cannot replace the next result', async () => {
    const h = harness();
    try {
      await assert.rejects(
        h.api.prepare(
          scenario(),
          options({
            onProgress(p) {
              if (p.phase === 'verifying') h.api.cancel();
            },
          }),
        ),
        code('start-cancelled'),
      );
      const r = await h.api.prepare(scenario(), options());
      await wait(5);
      assert.equal(r.status, 'initialized-not-committed');
      assert.equal(h.state.initCount, 2);
      assert.equal(h.state.frames.length, 0);
      assert.equal(h.listeners.size, 0);
    } finally {
      h.dispose();
    }
  });
  await test('remounting or navigating a preparation frame fails instead of accepting a new page as native', async () => {
    const h = harness({
      ready({ frame }) {
        frame.onload();
      },
    });
    try {
      await assert.rejects(h.api.prepare(scenario(), options()), code('native-frame-navigation'));
      assert.equal(h.state.frames.length, 0);
    } finally {
      h.dispose();
    }
  });
  await test('child runtime refuses ordinary page, same-origin child and desktop-bridge contexts before touching P', () => {
    const runtime = fs.readFileSync(path.join(__dirname, '../tm-start-preparation-runtime.js'), 'utf8');
    for (const kind of ['main', 'same-origin', 'bridge']) {
      const context = { __tmNativePreparation: {}, __tmNativePreparationState: {}, parent: { document: {} }, P: {} };
      context.window = context;
      if (kind === 'main') context.parent = context;
      if (kind === 'bridge') context.tianming = {};
      Object.defineProperty(context.P, 'scenarios', {
        set() {
          throw Error('private owner ran in live page');
        },
      });
      vm.runInNewContext(runtime, context);
      assert(!context.P.ai);
    }
  });
  console.log(`${pass} PASS / ${fail} FAIL`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
