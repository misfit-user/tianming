'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console }; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../tm-fiscal-ui.js'), 'utf8'), ctx);
const labels = ctx.PhaseG4.regionLabelsForDisplay;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function world(regions, adminHierarchy, records) { return { regions, adminHierarchy, fiscal: { regions: records } }; }
test('live administrative names win over stale snapshots without changing any ledger values', () => {
  const g = world([{id:'div_a',name:'旧名'}], {player:{divisions:[{id:'div_a',name:'新府名'}]}}, {div_a:{name:'旧账名',actualRevenue:234}});
  const before = JSON.stringify(g);
  assert.equal(labels(g).div_a,'新府名'); assert.equal(JSON.stringify(g),before);
  g.adminHierarchy.player.divisions[0].name='改府名'; assert.equal(labels(g).div_a,'改府名');
});
test('nested children, divisions and subRegions all resolve, including code and dictionary aliases', () => {
  const g = world({legacy:{name:'旧制府',subRegions:[{id:3,code:'div_code',name:'县名'}]}},
    {player:{divisions:[{id:'div_a',name:'道名',children:[{id:'div_b',name:'州名',divisions:[{id:'div_c',name:'县名'}]}]}]}},
    {div_a:{},div_b:{},div_c:{},legacy:{},div_code:{},3:{}});
  assert.deepEqual(JSON.parse(JSON.stringify(labels(g))),{div_a:'道名',div_b:'州名',div_c:'县名',legacy:'旧制府',div_code:'县名',3:'县名'});
});
test('missing data retains declared names or historical human-readable keys, never invents a region name', () => {
  const g = world(null,null,{div_declared:{regionName:'账册州名'},div_named:{name:'账册府名'},div_unknown:null,直隶:{}});
  assert.deepEqual(JSON.parse(JSON.stringify(labels(g))),{div_declared:'账册州名',div_named:'账册府名',div_unknown:'地区未载',直隶:'直隶'});
  assert.equal(Object.keys(labels(null)).length,0);
});
test('cycles, shared children and prototype-like IDs do not loop or corrupt the index', () => {
  const node={id:'__proto__',name:'府名'};node.children=[node];
  const records=JSON.parse('{"__proto__":{},"constructor":{}}');
  const g=world([node],{p:{divisions:[node,{id:'constructor',name:'县名'}]}},records);
  const r=labels(g);assert.equal(Object.getPrototypeOf(r),null);assert.equal(r.__proto__,'府名');assert.equal(r.constructor,'县名');
  assert.equal(node.children[0],node);
});
test('the actual Tianqi scenario IDs from the player report resolve from its administrative tree', () => {
  const sc=JSON.parse(fs.readFileSync(path.join(__dirname,'../../scenarios/天启七年·九月（官方）.json'),'utf8'));
  const divisions=sc.adminHierarchy.player.divisions;
  const records=Object.fromEntries(divisions.map(d=>[d.id,{actualRevenue:123}]));
  const g=world([],sc.adminHierarchy,records), before=JSON.stringify(g), r=labels(g);
  for(const d of divisions) assert.equal(r[d.id],d.name,d.id);
  assert.equal(JSON.stringify(g),before);
});
test('annual report escapes names and keys while treasury uses the same read-only display index', () => {
  const id='div_"<key>',name='<img src=x onerror=bad()>',g=world([{id,name}],null,{[id]:{actualRevenue:777}});
  g.guoku={history:{yearlyArchive:[{year:1,totalIncome:0,totalExpense:0}]}};
  ctx.GM=g;ctx.document={createElement:()=>({style:{},addEventListener(){}}),body:{appendChild:node=>{ctx.html=node.innerHTML;}}};
  ctx.PhaseG4.openYearlyReport();
  assert(!ctx.html.includes('<img'));assert(ctx.html.includes('&lt;img'));assert(ctx.html.includes('&quot;&lt;key&gt;'));
  assert.equal(g.fiscal.regions[id].actualRevenue,777);
  const source=fs.readFileSync(path.join(__dirname,'../tm-var-drawers.js'),'utf8');
  assert.match(source,/PhaseG4\.regionLabelsForDisplay\(G\)/);assert.match(source,/_esc\(regionName\)/);
});
console.log(passed+' PASS, 0 FAIL');
