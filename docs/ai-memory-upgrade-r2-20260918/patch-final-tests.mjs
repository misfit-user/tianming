import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-memory-model-detection.js', (s, r) => r(s, "kind: 'person' }) }], content: null", "kind: 'person' }) } }], content: null"));
edit('web/scripts/lib-memory-upgrade-r2.js', (s, r) => r(s, "'tm-memory-writegate.js','tm-memory-turn-inference.js'", "'tm-memory-writegate.js','tm-memory-controls.js','tm-memory-turn-inference.js'"));
edit('web/scripts/smoke-memory-adaptive-upgrade.js', (s, r) => r(s, 'function stewardFixture() {', `test('durable correction survives short-term control pruning and explicit undo works', () => {
  const c = context(); c.GM._memoryAccepted = [fact('ancient', 'An obsolete canal claim.')]; c.TM.MemoryLongTerm.capture(c.GM, c.GM._memoryAccepted);
  c.TM.MemoryControls.markFalse(c.GM, 'ancient');
  for (let i = 0; i < 85; i++) c.TM.MemoryControls.markFalse(c.GM, 'other-' + i);
  assert.equal(c.GM._memoryControls.ancient, undefined);
  assert(!c.TM.MemoryHybrid.collect(c.GM).some(h => h.id === 'ancient'));
  c.TM.MemoryControls.clearControl(c.GM, 'ancient'); assert(c.TM.MemoryHybrid.collect(c.GM).some(h => h.id === 'ancient'));
});
function stewardFixture() {`));
