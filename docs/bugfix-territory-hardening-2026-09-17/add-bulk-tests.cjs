'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const file=path.resolve(__dirname,'../../web/scripts/smoke-territory-hardening.js'),source=fs.readFileSync(file,'utf8');
const marker='(async()=>{let failed=0;for(const t of tests)';
const extra=`test('legacy bulk API counts ID/name aliases once and redraws once',()=>{
  const f=fixture();const count=f.ctx.TM.FactionMembership.bulkReassignProvinces((name,owner)=>owner==='甲国','fb');
  assert.equal(count,1);assert.equal(f.map.regions[0].owner,'fb');assert.equal(f.derived.length,1);
  assert.equal(f.refreshes.filter(x=>x==='formal').length,1);
});
test('legacy bulk API rolls back the entire selection on later failure',()=>{
  const f=fixture();Object.freeze(f.d2);const before=JSON.stringify(f.G);
  assert.throws(()=>f.ctx.TM.FactionMembership.bulkReassignProvinces(()=>true,''));
  assert.equal(JSON.stringify(f.G),before);assert.equal(f.events.length,0);assert.equal(f.refreshes.length,0);
});
`;
if(source.split(marker).length!==2)throw Error('test insertion anchor not unique');
const next=source.replace(marker,extra+marker);new vm.Script(next,{filename:file});
fs.writeFileSync(path.join(__dirname,'hardening-26-tests.bak'),source,{flag:'wx'});fs.writeFileSync(file,next);
console.log('BULK_TESTS_INSTALLED');
