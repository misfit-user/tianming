'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Offline regression: node web/scripts/smoke-map-editor-admin-roundtrip.js [web-root] [repo-root]
const webRoot=path.resolve(process.argv[2] || path.join(__dirname,'..'));
const root=path.resolve(process.argv[3] || path.join(webRoot,'..'));
const bridge=require(path.join(webRoot,'map-editor-to-game.js'));
const AA=require(path.join(webRoot,'editor-authoring-agent.js'));
let pass=0;
function test(name,fn){fn();pass++;console.log('PASS '+name);}
const copy=x=>JSON.parse(JSON.stringify(x));
const f=[{id:'f',name:'楚'}];
function convert(rows){return bridge.convertMapEditorToAdminHierarchy({factions:copy(f),divisions:rows});}
function flatten(tree){const out=[];function walk(ns){for(const n of ns){out.push(n);walk(n.children||[]);}}for(const branch of Object.values(tree))walk(branch.divisions);return out;}
function fixture(){return {factions:copy(f),divisions:[{id:'p',name:'道',population:65,factionId:'f',children:[{id:'c',name:'州',population:65,children:[{id:'l',name:'县',population:65,custom:{keep:true}}]}]},{id:'c',name:'州',parentId:'p',population:65,factionId:'f'}]};}
test('mixed nested and flat rows count each child once',()=>{
  const tree=bridge.convertMapEditorToAdminHierarchy(fixture());
  assert.deepEqual(flatten(tree).map(n=>n.id),['p','c','l']);
  assert.equal(tree['楚'].divisions[0].children.length,1);
  assert(AA.validateDraft({adminHierarchy:tree},'admin-population').ok);
});
test('conversion leaves input byte-for-byte unchanged and repeats identically',()=>{
  const input=fixture(),before=JSON.stringify(input);
  const a=bridge.convertMapEditorToAdminHierarchy(input),b=bridge.convertMapEditorToAdminHierarchy(input);
  assert.equal(JSON.stringify(input),before); assert.deepEqual(a,b);
});
test('output gameplay objects are independent from the input',()=>{
  const input=fixture(); const tree=bridge.convertMapEditorToAdminHierarchy(input);
  flatten(tree).find(n=>n.id==='l').custom.keep=false;
  assert.equal(input.divisions[0].children[0].children[0].custom.keep,true);
});
test('nested-only grandchildren are preserved when parent also has a flat edited copy',()=>{
  const input=fixture();input.divisions[1].population=90;input.divisions[1].name='新州';
  const tree=bridge.convertMapEditorToAdminHierarchy(input),nodes=flatten(tree);
  assert.equal(nodes.find(n=>n.id==='c').name,'新州');
  assert.equal(nodes.find(n=>n.id==='c').population,90);
  assert.equal(nodes.find(n=>n.id==='l').parentId,'c');
  assert.equal(nodes.find(n=>n.id==='l').custom.keep,true);
});
test('flat rows are linked by parentId regardless of input order',()=>{
  const tree=convert([{id:'l',name:'县',parentId:'c',factionId:'f'},{id:'c',name:'州',parentId:'p',factionId:'f'},{id:'p',name:'道',factionId:'f'}]);
  assert.deepEqual(flatten(tree).map(n=>n.id),['p','c','l']);
});
test('explicit parentId wins over stale containment without duplicating a child',()=>{
  const tree=convert([{id:'p1',name:'旧道',factionId:'f',children:[{id:'c',name:'州'}]},{id:'p2',name:'新道',factionId:'f'},{id:'c',name:'州',parentId:'p2',factionId:'f'}]);
  assert.equal(tree['楚'].divisions.find(n=>n.id==='p1').children.length,0);
  assert.deepEqual(tree['楚'].divisions.find(n=>n.id==='p2').children.map(n=>n.id),['c']);
});
test('same-name leaves with different stable IDs both survive',()=>{
  const tree=convert([{id:'p',name:'道',factionId:'f',children:[{id:'a',name:'同名县'},{id:'b',name:'同名县'}]}]);
  assert.deepEqual(flatten(tree).map(n=>n.id),['p','a','b']);
});
test('nested rows without stable IDs are preserved independently',()=>{
  const tree=convert([{id:'p',name:'道',factionId:'f',children:[{name:'甲县'},{name:'乙县'}]}]);
  assert.equal(tree['楚'].divisions[0].children.length,2);
});
test('ambiguous duplicated flat IDs are rejected without changing input',()=>{
  const rows=[{id:'p',name:'甲',factionId:'f'},{id:'p',name:'乙',factionId:'f'}],before=JSON.stringify(rows);
  assert.throws(()=>convert(rows),/重复行政区划 ID/);assert.equal(JSON.stringify(rows),before);
});
test('conflicting nested-only names sharing one stable ID are rejected without losing a node',()=>{
  const rows=[{id:'p',name:'道',factionId:'f',children:[{id:'c',name:'甲州'},{id:'c',name:'乙州'}]}],before=JSON.stringify(rows);
  assert.throws(()=>convert(rows),/ID 对应多个名称/);assert.equal(JSON.stringify(rows),before);
});
test('an unnamed flat placeholder cannot authorize discarding conflicting nested names',()=>{
  assert.throws(()=>convert([{id:'c'},{id:'p',name:'道',factionId:'f',children:[{id:'c',name:'甲州'},{id:'c',name:'乙州'}]}]),/ID 对应多个名称/);
});
test('an initially unnamed nested node still rejects later competing names',()=>{
  assert.throws(()=>convert([{id:'p',name:'道',factionId:'f',children:[{id:'c'},{id:'c',name:'甲州'},{id:'c',name:'乙州'}]}]),/ID 对应多个名称/);
});
test('parent cycles are rejected instead of removing all roots',()=>{
  assert.throws(()=>convert([{id:'a',parentId:'b',factionId:'f'},{id:'b',parentId:'a',factionId:'f'}]),/循环/);
});
test('multiple containment parents need an explicit parentId',()=>{
  assert.throws(()=>convert([{id:'p1',factionId:'f',children:[{id:'c',name:'州'}]},{id:'p2',factionId:'f',children:[{id:'c',name:'州'}]}]),/多个父级/);
});
test('dangling explicit parents keep existing top-level fallback',()=>{
  const tree=convert([{id:'c',name:'州',parentId:'missing',factionId:'f'}]);
  assert.equal(tree['楚'].divisions[0].id,'c');
  assert.equal(tree['楚'].divisions[0].parentId,'missing');
});
test('nonobject children are rejected without silently dropping leaves',()=>{
  assert.throws(()=>convert([{id:'p',factionId:'f',children:['missing-node-object']}]),/必须是对象/);
});
test('region-coverage recognizes nested leaves and preserves real binding errors',()=>{
  const draft={adminHierarchy:bridge.convertMapEditorToAdminHierarchy(fixture()),map:{regions:[{id:'r',name:'县',adminBinding:'县'}]}};
  assert(AA.validateDraft(draft,'region-coverage').ok);
  draft.map.regions[0].adminBinding='失踪县';
  assert(!AA.validateDraft(draft,'region-coverage').ok);
});
for(const file of ['天启七年·九月（官方）.json','晚唐·开成五年（官方）.json','绍宋·建炎元年八月（官方）.json'])test('official roundtrip preserves administrative node IDs and leaf counts: '+file,()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'scenarios',file),'utf8'));
  // The late-Tang canonical data contains legacy duplicate wrapper IDs;
  // their runtime migration assigns deterministic IDs before map editing.
  const seen=new Set();let suffix=0;
  for(const node of flatten(d.adminHierarchy||{}))if(node.id){if(seen.has(String(node.id)))node.id+='-fixture-duplicate-'+(++suffix);seen.add(String(node.id));}
  const native=bridge.convertScenarioToMapEditor(d),before=JSON.stringify(native);
  const actual=flatten(bridge.convertMapEditorToAdminHierarchy(native));
  const expected=flatten(d.adminHierarchy||{});
  assert.equal(actual.length,expected.length);
  assert.deepEqual(actual.map(n=>n.id).sort(),expected.map(n=>n.id).sort());
  assert.equal(actual.filter(n=>!n.children.length).length,expected.filter(n=>!n.children?.length).length);
  assert.equal(JSON.stringify(native),before);
});
console.log(JSON.stringify({passed:pass,failed:0}));
