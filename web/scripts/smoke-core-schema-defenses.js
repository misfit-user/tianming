#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const saveSource = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const officeSource = fs.readFileSync(path.join(ROOT, 'tm-office-system.js'), 'utf8');
const applySource = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error('[smoke-core-schema-defenses] ' + message);
  passed++;
}

const normalizeStart = saveSource.indexOf('function _tmNormalizeCoreWorldCollections(gm) {');
const normalizeEnd = saveSource.indexOf('\nif (typeof window !==', normalizeStart);
assert(normalizeStart >= 0 && normalizeEnd > normalizeStart, 'core world normalizer is locatable');
const normalizeCtx = { Number, Array, Object, Error };
vm.runInNewContext(saveSource.slice(normalizeStart, normalizeEnd), normalizeCtx, { filename: 'tm-save-core-normalizer.js' });

const missing = { turn: 2 };
const repaired = normalizeCtx._tmNormalizeCoreWorldCollections(missing);
assert(repaired.ok && Array.isArray(missing.chars) && Array.isArray(missing.facs) && Array.isArray(missing.officeTree), 'missing array collections receive safe defaults');
assert(missing.vars && !Array.isArray(missing.vars) && missing.rels && !Array.isArray(missing.rels), 'missing object collections receive safe defaults');
assert(missing._schemaNormalizationDiagnostics.length === 5, 'safe migration actions remain diagnosable');

const emptyLegacy = { vars: [], rels: [], chars: {}, facs: {}, officeTree: {}, turn: 3 };
normalizeCtx._tmNormalizeCoreWorldCollections(emptyLegacy);
assert(!Array.isArray(emptyLegacy.vars) && !Array.isArray(emptyLegacy.rels) && Array.isArray(emptyLegacy.chars) && Array.isArray(emptyLegacy.facs), 'empty wrong-shape legacy containers are repaired without data loss');

for (const [field, value] of [['chars', { named: { id: 'x' } }], ['facs', 'broken'], ['vars', ['non-empty']], ['rels', 7], ['officeTree', { dept: '吏部' }]]) {
  const world = { vars: {}, rels: {}, chars: [], facs: [], officeTree: [] };
  world[field] = value;
  let error = null;
  try { normalizeCtx._tmNormalizeCoreWorldCollections(world); } catch (caught) { error = caught; }
  assert(error && error.code === 'save-core-schema-invalid' && error.field === field, 'non-empty malformed ' + field + ' rejects load instead of silently erasing data');
}

const walkStart = officeSource.indexOf('function _offWalkOfficeTree(nodes, visitor, chain) {');
const walkEnd = officeSource.indexOf('\n/**', walkStart);
assert(walkStart >= 0 && walkEnd > walkStart, 'official office-tree walker is locatable');
const walkCtx = {};
vm.runInNewContext(officeSource.slice(walkStart, walkEnd), walkCtx, { filename: 'tm-office-walker.js' });
let names = [];
const tree = [
  { name: '中书省', subs: null },
  { name: '尚书省', subs: {} },
  { name: '御史台' },
  { name: '六部', subs: [{ name: '吏部', subs: [{ name: '考功司', subs: { corrupt: true } }] }] }
];
assert(walkCtx._offWalkOfficeTree(tree, (node) => { names.push(node.name); }) === true, 'walker tolerates null/object/missing subs without throwing');
assert(names.join(',') === '中书省,尚书省,御史台,六部,吏部,考功司', 'walker visits only real array children in stable order');
names = [];
assert(walkCtx._offWalkOfficeTree({ not: 'an array' }, () => { names.push('bad'); }) === true && names.length === 0, 'non-array root is a safe no-op');

assert(!/if\s*\(\s*(?:n|node|nd|nd2)\.subs\s*\)\s*(?:\{|[^\n])/.test(officeSource), 'office system has no truthy-only recursive subs walk');
assert(!/if\s*\(\s*(?:n|node|nd|nd2)\.subs\s*\)\s*(?:\{|[^\n])/.test(applySource), 'end-turn office consumers have no truthy-only recursive subs walk');

console.log('[smoke-core-schema-defenses] pass assertions=' + passed);
