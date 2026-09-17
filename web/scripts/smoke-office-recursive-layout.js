#!/usr/bin/env node
'use strict';
// Extract the actual production layout and path resolver, not a duplicate renderer.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), acorn = require('acorn');
const source = fs.readFileSync(path.join(__dirname, '../tm-office-editor.js'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
const functions = ['_officeBuildTreeV10', '_officeGetByPath'].map(name => {
  const node = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
  assert(node, 'production function exists: ' + name); return source.slice(node.start, node.end);
}).join('\n');
const tree = [{ name: '户部', group: 'finance', positions: [{ name: '尚书' }], subs: [
  { name: '税核司', positions: [{ name: '稽核官' }], subs: [{ name: '簿籍房', positions: [{ name: '书吏' }], subs: [] }] }
] }, { name: '工部', group: 'works', positions: [{ name: '营造官' }], subs: [] }];
const original = JSON.stringify(tree);
(function freeze(o) { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); })(tree);
const c = { P: { officeTree: tree }, _officeClassifyDept: d => ({ court: 'central', group: d.group || 'finance' }),
  OFFICE_SUBTABS: { central: [{ key: 'all' }, { key: 'finance' }, { key: 'works' }] } };
vm.createContext(c); vm.runInContext(functions, c, { filename: 'actual-office-layout.js' });
const layout = opts => c._officeBuildTreeV10(Object.assign({ officeTree: tree }, opts));
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }
test('every nested department and post has its real canonical path and parent', () => {
  const out = layout(), nodes = out.flat.filter(n => n.type === 'dept' || n.type === 'pos');
  assert.equal(nodes.length, 8);
  for (const n of nodes) { assert.equal(c._officeGetByPath(n.path), n.node); assert(n.parent.children.includes(n)); }
  const clerk = nodes.find(n => n.node.name === '书吏');
  assert.deepEqual(Array.from(clerk.path), [0, 's', 0, 's', 0, 'p', 0]); assert.equal(clerk.parent.node.name, '簿籍房');
  assert.equal(clerk.deptName, '簿籍房'); assert.equal(clerk.depth, 5);
});
test('nested rows and subsequent groups cannot overlap or leave the canvas', () => {
  const out = layout();
  for (const n of out.flat) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y)); assert(n.x >= 0 && n.y >= 0);
    assert(n.x + n.w <= out.width && n.y + n.h <= out.height);
    if (n.parent) assert(n.y > n.parent.y + n.parent.h);
  }
  const group = out.groupNodes[0], next = out.groupNodes[1];
  (function visit(n) { assert(n.y + n.h < next.y); n.children.forEach(visit); })(group);
});
test('collapse state uses the full branch path and hides only that branch descendants', () => {
  const collapsed = { '[0,"s",0]': true }, out = layout({ collapsed });
  const names = out.flat.filter(n => n.node).map(n => n.node.name);
  assert(names.includes('税核司')); assert(!names.includes('稽核官')); assert(!names.includes('簿籍房'));
  assert(names.includes('尚书') && names.includes('营造官')); assert.equal(collapsed['[0,"s",0]'], true);
  const root = layout({ collapsed: { '[0]': true } });
  assert(!root.flat.some(n => n.node && n.node.name === '税核司'));
});
test('filtering retains source indices and never changes the authoritative structure', () => {
  const out = layout({ subTab: 'works' }); assert.equal(out.groupNodes.length, 1);
  const post = out.flat.find(n => n.type === 'pos'); assert.deepEqual(Array.from(post.path), [1, 'p', 0]);
  assert.equal(JSON.stringify(tree), original);
});
console.log(`office recursive layout: ${passed} PASS, ${failed} FAIL`); process.exitCode = failed ? 1 : 0;
