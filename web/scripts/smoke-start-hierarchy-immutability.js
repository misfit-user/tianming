'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const ctx = { console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../tm-economy-engine.js'), 'utf8'), ctx);
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log('PASS ' + name);
}
function source() {
  return {
    id: 'one',
    adminHierarchy: { player: { divisions: [{ id: 'root', children: [{ id: 'child', parentId: 'root' }] }] } },
  };
}
test('standalone hierarchy preparation derives levels without modifying author-owned templates', () => {
  const s = source(),
    before = JSON.stringify(s);
  const result = ctx.EconomyGapFill.buildHierarchyFromAdminDepth(s);
  assert.equal(result.byId.root.level, 0);
  assert.equal(result.byId.child.level, 1);
  assert.equal(JSON.stringify(s), before);
});
test('matching active world receives its runtime levels without mutating the catalog', () => {
  const s = source(),
    before = JSON.stringify(s);
  ctx.GM = { running: true, sid: s.id, adminHierarchy: JSON.parse(JSON.stringify(s.adminHierarchy)) };
  const result = ctx.EconomyGapFill.buildHierarchyFromAdminDepth(s);
  assert.equal(result.byId.child.level, 1);
  assert.equal(ctx.GM.adminHierarchy.player.divisions[0].children[0].level, 1);
  assert.equal(JSON.stringify(s), before);
});
test('inspecting another scenario cannot modify the current game tree', () => {
  const s = source();
  s.id = 'two';
  const before = JSON.stringify(ctx.GM);
  ctx.EconomyGapFill.buildHierarchyFromAdminDepth(s);
  assert.equal(JSON.stringify(ctx.GM), before);
  assert.equal(s.adminHierarchy.player.divisions[0].level, undefined);
});
console.log(count + ' PASS / 0 FAIL');
