import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-memory-adaptive-upgrade.js', (s, r) => r(s, 'function stewardFixture() {', `test('canonical IDB and project snapshot constructors retain detached long-term archives', () => {
  const fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn');
  const { ROOT } = require('./lib-memory-upgrade-r2');
  const c = context(); c.TM.MemoryLongTerm.capture(c.GM, [fact('saved', 'Long-term evidence survives both save wrappers.')]);
  c.deepClone = value => JSON.parse(JSON.stringify(value)); c._tmStripAiKeyInPlace = value => value;
  const source = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
  const tree = acorn.parse(source, { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  for (const name of ['_tmSaveSnapshotSkipKeys', '_autoSaveSnapshotGM', '_buildSaveState']) {
    const node = tree.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name); assert(node, name);
    vm.runInContext(source.slice(node.start, node.end), c);
  }
  const idb = c._buildSaveState({ format: 'idb', prepare: false, detach: true });
  const project = c._buildSaveState({ format: 'project', prepare: false, detach: true });
  assert.equal(idb.GM._memoryLongTerm.records[0].id, 'saved'); assert.equal(project.gameState._memoryLongTerm.records[0].id, 'saved');
  c.GM._memoryLongTerm.records[0].body = 'Live change after snapshot';
  assert.notEqual(idb.GM._memoryLongTerm.records[0].body, c.GM._memoryLongTerm.records[0].body);
  assert.equal(JSON.parse(JSON.stringify(project)).gameState._memoryLongTerm.records[0].id, 'saved');
});
function stewardFixture() {`));
