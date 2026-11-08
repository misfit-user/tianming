'use strict';
// Run: node --expose-gc docs/npc-stable-candidate-20261021/measure-atomic-snapshot.cjs
// This measures a rejected optimization; it does not alter runtime code/data.
const fs = require('node:fs'), path = require('node:path'), { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '../..');
const scenario = JSON.parse(fs.readFileSync(path.join(root, 'scenarios/绍宋·建炎元年八月（官方）.json'), 'utf8'));
const samples = [
  ['synthetic', { mapData: { regions: Array.from({ length: 20000 }, (_, i) => ({ id: 'r' + i, points: Array.from({ length: 8 }, (_, j) => [i + j / 10, i - j / 10]) })) }, chars: [{ id: 'a' }], turn: 1 }],
  ['official-independent-P', { scenarios: [scenario], map: structuredClone(scenario.map), characters: structuredClone(scenario.characters) }]
];
function eligible(value, seen = new WeakSet()) {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  if (type === 'number') return Number.isFinite(value) && !Object.is(value, -0);
  if (type !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value), keys = Object.keys(value);
  if (!array && proto !== Object.prototype && proto !== null || array && keys.length !== value.length) return false;
  return keys.every(key => { const d = Object.getOwnPropertyDescriptor(value, key); return d && !d.get && !d.set && eligible(d.value, seen); });
}
const results = samples.map(([name, value]) => {
  if (global.gc) global.gc();
  let start = performance.now(), cloned = structuredClone(value);
  const originalCloneMs = performance.now() - start; cloned = null;
  if (global.gc) global.gc();
  start = performance.now(); const safe = eligible(value), jsonSafetyCheckMs = performance.now() - start;
  start = performance.now(); const json = JSON.stringify(value), jsonSerializeMs = performance.now() - start;
  return { name, bytes: Buffer.byteLength(json), originalCloneMs, jsonSafetyCheckMs, jsonSerializeMs, checkedLazyCaptureMs: jsonSafetyCheckMs + jsonSerializeMs, eligible: safe };
});
const report = { node: process.version, method: 'actual structuredClone vs native JSON bytes plus descriptor/type/shared-reference eligibility scan; no runtime optimization retained', results };
fs.writeFileSync(path.join(__dirname, 'atomic-snapshot-safety-comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
