'use strict';
const assert = require('assert/strict'), path = require('path'), { createHash } = require('crypto');
const { storage, ROOT } = require('./lib-perf-round1');
const at = process.argv.indexOf('--repo'), root = at < 0 ? ROOT : path.resolve(process.argv[at + 1]);
let passed = 0, failed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } }
const fnv = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return 'fnv1a-' + (h >>> 0).toString(16).padStart(8, '0'); };
(async () => {
  for (const gzip of [true, false]) await check('Unicode/order/freeze/roundtrip; gzip=' + gzip, async () => {
    const h = storage(root); h.c.SaveCompression.supported = gzip;
    const state = { z: '诏令😀e\u0301\u0000', a: '\ud800', list: ['é', '👩‍👩‍👧‍👦', '中文'] }, identity = { campaignId: 'c', timelineId: 'tml_a', turn: 9 };
    const json = JSON.stringify(state), p = await h.c.TM_SaveDB.createCanonicalPayload(state, identity);
    assert.equal(p.json, json); assert.equal(p.state, state); assert.notEqual(p.identity, identity);
    assert(Object.isFrozen(p)); assert(Object.isFrozen(p.identity));
    assert.equal(p.jsonByteLength, Buffer.byteLength(json));
    assert.equal(p.checksum, createHash('sha256').update(json).digest('hex'));
    assert.equal(await h.c.SaveCompression.decompress(p.compressed), json);
    assert.equal(p.compressedByteLength, gzip ? p.compressed.size : Buffer.byteLength(json));
  });
  for (const gzip of [true, false]) await check('one explicit UTF-8 encoding; gzip=' + gzip, async () => {
    const h = storage(root); h.c.SaveCompression.supported = gzip;
    await h.c.TM_SaveDB.createCanonicalPayload({ text: '中文😀'.repeat(4096) });
    assert.equal(h.work.encodes, 1);
  });
  for (const missing of ['crypto', 'TextEncoder', 'both']) await check('legacy FNV with missing ' + missing, async () => {
    const h = storage(root, { ...(missing !== 'crypto' ? { TextEncoder: undefined } : {}), ...(missing !== 'TextEncoder' ? { crypto: undefined } : {}) });
    h.c.SaveCompression.supported = false;
    const state = { text: '😀e\u0301中文' }, p = await h.c.TM_SaveDB.createCanonicalPayload(state);
    assert.equal(p.checksum, fnv(p.json)); assert.equal(p.jsonByteLength, Buffer.byteLength(p.json));
    assert.equal(p.compressed, p.json);
  });
  await check('compression error keeps exact JSON and byte counts', async () => {
    const h = storage(root, { CompressionStream: class { constructor() { throw new Error('injected compression'); } } });
    const p = await h.c.TM_SaveDB.createCanonicalPayload({ text: '中文😀' });
    assert.equal(p.compressed, p.json); assert.equal(p.compressedByteLength, p.jsonByteLength);
    assert.equal(h.work.warnings.filter(w => w.includes('[SaveCompression]')).length, 1);
    assert.equal(h.work.encodes, 1);
  });
  await check('digest failure rejects; subsequent independent save recovers', async () => {
    let reject = true;
    const h = storage(root, { crypto: { subtle: { digest: (...args) => reject ? Promise.reject(new Error('digest-failed')) : require('crypto').webcrypto.subtle.digest(...args) } } });
    await assert.rejects(() => h.c.TM_SaveDB.createCanonicalPayload({ a: 1 }), /digest-failed/);
    reject = false; assert.equal((await h.c.TM_SaveDB.createCanonicalPayload({ a: 2 })).json, '{"a":2}');
  });
  await check('invalid/throwing input never produces a payload', async () => {
    const h = storage(root), cycle = {}; cycle.self = cycle;
    for (const x of [undefined, () => {}, cycle, { n: 1n }, { toJSON() { throw new Error('invalid'); } }]) {
      await assert.rejects(async () => h.c.TM_SaveDB.createCanonicalPayload(x));
    }
  });
  await check('async digest freezes JSON before mutation and keeps concurrent identities separate', async () => {
    const digest = require('crypto').webcrypto.subtle.digest.bind(require('crypto').webcrypto.subtle);
    let resume; const gate = new Promise(resolve => { resume = resolve; });
    const h = storage(root, { crypto: { subtle: { digest: async (...args) => { await gate; return digest(...args); } } } });
    const state = { n: 1 }, a = h.c.TM_SaveDB.createCanonicalPayload(state, { timelineId: 'tml_A' });
    state.n = 2; const b = h.c.TM_SaveDB.createCanonicalPayload(state, { timelineId: 'tml_B' }); resume();
    const [pa, pb] = await Promise.all([a, b]); assert.equal(pa.json, '{"n":1}'); assert.equal(pb.json, '{"n":2}');
    assert.equal(pa.identity.timelineId, 'tml_A'); assert.equal(pb.identity.timelineId, 'tml_B'); assert.notEqual(pa.checksum, pb.checksum);
  });
  console.log(JSON.stringify({ passed, failed })); process.exitCode = failed ? 1 : 0;
})();
