'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
let service;
const context = {
  TextEncoder,
  TextDecoder,
  Map,
  Set,
  Array,
  Number,
  Object,
  JSON,
  console,
  TM: {
    AuthoringExtensions: {
      registerWorkbench(s) {
        service = s;
      },
    },
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tm-workbench-service.js'), 'utf8'), context);
const operations = [
  { op: 'renameDisplay', regionId: 'rb', newName: '乙郡' },
  { type: 'renameDisplay', regionId: 'rb', newName: '乙郡' },
  { type: 'renameDisplay', regionId: 'rb', displayName: '乙郡' },
  { type: 'renameDisplay', regionId: 'rb', name: '乙郡' },
];
let pass = 0;
function test(name, fn) {
  fn();
  pass++;
  console.log('PASS ' + name);
}
test('all four recorded real-provider rename shapes normalize to the same canonical operation without mutating input', () => {
  const before = JSON.stringify(operations),
    expected = JSON.stringify({ type: 'renameDisplay', regionId: 'rb', name: '乙郡' });
  for (const op of operations) {
    const result = service.normalizeMapOperations([op])[0];
    assert.equal(result.type, 'renameDisplay');
    assert.equal(result.regionId, 'rb');
    assert.equal(result.name, '乙郡');
    assert.equal(Object.keys(result).length, 3);
  }
  assert.equal(JSON.stringify(operations), before);
  assert(expected);
});
test('conflicting aliases, missing fields, unsupported operations and unknown fields fail with actionable parameters', () => {
  for (const op of [
    { type: 'renameDisplay', op: 'assignScenarioControl', regionId: 'rb', name: 'x' },
    { type: 'renameDisplay', regionId: 'rb', name: 'x', newName: 'y' },
    { type: 'renameDisplay', regionId: 'rb', newName: 'x', displayName: 'y' },
    { type: 'renameDisplay', regionId: 'rb' },
    { type: 'toString' },
    { type: 'renameDisplay', regionId: 'rb', name: 'x', execute: 'arbitrary' },
  ])
    assert.throws(() => service.normalizeMapOperations([op]), /冲突|参数|type/);
});
test('failure recovery keys distinguish operation ID, map, region and operation but tolerate a repaired value', () => {
  const key = (op) => JSON.stringify(service.writeTargets('proposeMapOperations', op)),
    base = { operationId: 'same', mapAssetId: 'map', operations: [operations[0]] };
  assert.equal(key(base), key({ ...base, operations: [operations[3]] }));
  for (const next of [
    { ...base, operationId: 'unrelated' },
    { ...base, mapAssetId: 'other' },
    { ...base, operations: [{ type: 'renameDisplay', regionId: 'ra', name: 'x' }] },
    { ...base, operations: [{ type: 'assignScenarioControl', regionId: 'rb', controllerFactionId: 'fa' }] },
  ])
    assert.notEqual(key(base), key(next));
});
console.log(pass + ' PASS / 0 FAIL');
