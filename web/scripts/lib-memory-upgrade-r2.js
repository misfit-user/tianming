'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const modules = ['tm-memory-adaptive.js','tm-memory-long-term.js','tm-memory-hybrid.js','tm-memory-trace.js','tm-memory-evidence-registry.js','tm-memory-source-bound.js','tm-context-zones.js','tm-memory-envelope.js','tm-memory-governance.js','tm-memory-retrieval.js','tm-memory-writegate.js','tm-memory-controls.js','tm-memory-turn-inference.js','tm-memory-context-compiler.js','tm-memory-agent-tools.js','tm-memory-steward.js'];
function context(extra = {}) {
  const c = Object.assign({ console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, URL, Number, Object, Array, Error, Promise, Map, Set, WeakMap, AbortController, AbortSignal, setTimeout, clearTimeout, setInterval() { return 1; }, clearInterval() {}, addEventListener() {},
    P: { ai: { url: 'https://relay.invalid/v1', model: 'test-model', key: 'synthetic-test-key' }, conf: { contextSizeK: 64 } },
    GM: { turn: 10, _campaignId: 'tmc_test_12345678', _timelineId: 'tml_test_12345678', chars: [], _memoryAccepted: [] }
  }, extra);
  c.window = c; c.globalThis = c; vm.createContext(c);
  modules.forEach(file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c, { filename: file }));
  return c;
}
function fact(id, body, extra = {}) {
  return Object.assign({ id, body, safeBody: body, type: 'semantic_fact', status: 'active', reviewStatus: 'accepted', authority: 'event_log', authorityRank: 58, sourceRefs: [{ type: 'eventLog', id }], readScope: 'public', visibility: 'public', turn: 4 }, extra);
}
function profile(c, failed = [], tier = 'primary', unavailable = []) {
  const lease = c.TM.MemoryAdaptive.beginProbe(tier);
  const report = { model: c.P.ai.model, checks: ['json_schema','memory_recall','memory_synthesis','memory_tools'].map(id => ({ id, ok: !failed.includes(id) && !unavailable.includes(id), state: unavailable.includes(id) ? 'unavailable' : failed.includes(id) ? 'failed' : 'supported' })) };
  c.TM.MemoryAdaptive.commitEvidence(report, lease);
  return report;
}
module.exports = { context, fact, profile, ROOT };
function semantic(c) {
  const rows = new Map(); let created = false, failNextWrite = false, deletes = 0, embeds = 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  function request(value) { const r = {}; setTimeout(() => { if (r.onsuccess) r.onsuccess({ target: { result: clone(value) } }); }, 0); return r; }
  function store(pending) { return {
    indexNames: { contains() { return true; } }, createIndex() {},
    put(value) { pending.push(() => rows.set(value.id, clone(value))); },
    delete(id) { pending.push(() => { rows.delete(id); deletes++; }); },
    getAll() { return request(Array.from(rows.values())); },
    index() { return { getAll(key) { return request(Array.from(rows.values()).filter(r => r.campaignId === key[0] && r.timelineId === key[1] && r.modelVersion === key[2])); } }; }
  }; }
  const db = { objectStoreNames: { contains() { return created; } }, createObjectStore() { created = true; return store([]); },
    transaction(_name, mode) {
      const pending = [], tx = { objectStore() { return store(pending); }, abort() { tx.aborted = true; } };
      const failed = mode === 'readwrite' && failNextWrite; if (failed) failNextWrite = false;
      setTimeout(() => { if (failed || tx.aborted) { tx.error = new Error('injected atomic index failure'); if (tx.onabort) tx.onabort({ target: tx }); } else { pending.forEach(fn => fn()); if (tx.oncomplete) tx.oncomplete({ target: tx }); } }, 5);
      return tx;
    }
  };
  c.indexedDB = { open() { const req = {}; setTimeout(() => { if (!created && req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } }); if (req.onsuccess) req.onsuccess({ target: { result: db } }); }, 0); return req; } };
  let source = fs.readFileSync(path.join(ROOT, 'tm-semantic-recall.js'), 'utf8');
  source = source.replace('  // ────── Worker RPC（perf round5）', '  global.__semanticState = STATE;\n  // ────── Worker RPC（perf round5）');
  source = source.replace('  async function ensureModel() {', '  async function ensureModel() { if (global.__testEnsureModel) return global.__testEnsureModel();');
  vm.runInContext(source, c, { filename: 'tm-semantic-recall.js' });
  c.__semanticState.enabled = true; c.__semanticState.modelReady = true;
  c.__semanticState.pipeline = async input => { const texts = Array.isArray(input) ? input : [input]; embeds += texts.length; return { data: Float32Array.from(texts.flatMap(() => [1, 0])) }; };
  return { rows, failWrite() { failNextWrite = true; }, stats() { return { deletes, embeds }; } };
}
module.exports.semantic = semantic;
