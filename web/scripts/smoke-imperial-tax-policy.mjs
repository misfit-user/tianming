import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=process.env.TM_TEST_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const overlay=process.env.TM_TEST_OVERLAY;const read=f=>fs.readFileSync(overlay&&fs.existsSync(path.join(overlay,f))?path.join(overlay,f):path.join(root,f),'utf8');
let passed=0,failed=0;function test(name,f){try{f();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' '+e.stack);}}
function harness(){
 const g={turn:1,playerInfo:{factionId:'own',factionName:'本朝'},facs:[{id:'own',name:'本朝'},{id:'other',name:'外国'}],chars:[],guoku:{money:1234},
  fiscalConfig:{taxList:[{id:'land',name:'田赋',base:'arableLand',rate:.1,annual:false,storeAs:'money'},{id:'commerce',name:'商税',base:'commerce',rate:.1,annual:false,storeAs:'money'}]},
  adminHierarchy:{'本朝':{divisions:[{id:'sx',name:'陕西',economyBase:{farmland:1000,commerceVolume:1000}},{id:'hn',name:'河南',economyBase:{farmland:1000,commerceVolume:1000}}]},'外国':{divisions:[{id:'foreign',name:'外国地区'}]}},
  mapData:{regions:[{id:'sx',name:'陕西',owner:'own'},{id:'hn',name:'河南',owner:'own'},{id:'foreign',name:'外国地区',owner:'other'}]}};
 const c={console,GM:g,P:{time:{daysPerTurn:30}},setTimeout(){},clearTimeout(){},addEB(){},toast(){}};c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-fiscal-engine.js','tm-edict-parser.js','tm-tax-policy.js','tm-native-fiscal-adapter.js'])vm.runInContext(read('web/'+f),c,{filename:f});
 const command=text=>c.EdictParser.tryExecute(text,{},{});
 const amount=(id,tax=0,days=30)=>c.FiscalEngine.assessTax(g.adminHierarchy['本朝'].divisions.find(d=>d.id===id),g.fiscalConfig.taxList[tax],{game:g,accountingV2:true,fiscalConfig:g.fiscalConfig,turnDays:days});
 return{g,c,command,amount};
}
test('national exemption changes actual assessment; expiry restores original tax',()=>{const h=harness();assert.equal(h.amount('sx'),100);assert(h.command('免除全国赋税一年').ok);assert.equal(h.amount('sx'),0);assert.equal(h.amount('hn',1),0);h.g.turn=13;assert.equal(h.amount('sx'),100);assert.equal(h.g.guoku.money,1234);});
test('local exemption does not alter another region or tax type',()=>{const h=harness();assert(h.command('陕西免田赋三个月，其他地区不变').ok);assert.equal(h.amount('sx'),0);assert.equal(h.amount('hn'),100);assert.equal(h.amount('sx',1),100);h.g.turn=4;assert.equal(h.amount('sx'),100);});
test('local reduction and absolute increase use specified values, not 3%',()=>{const h=harness();assert(h.command('陕西田赋按亩减免50%，其他地方不变').ok);assert.equal(h.amount('sx'),50);assert.equal(h.amount('hn'),100);assert(h.command('将全国商税提高到15%').ok);assert.equal(h.amount('sx',1),150);});
test('explicit zero is not replaced by a default',()=>{const h=harness();assert(h.c.EdictParser.tryExecute('全国商税税率为0%',{rate:0},{}).ok);assert.equal(h.amount('sx',1),0);assert.equal(h.g.fiscalConfig.customTaxes,undefined);});
test('relative increase, restoration and idempotent replay',()=>{const h=harness();const t='全国商税提高两成';assert(h.command(t).ok);assert(h.command(t).duplicate);assert.equal(h.amount('sx',1),120);assert(h.command('恢复全国商税').ok);assert.equal(h.amount('sx',1),100);});
test('unknown or foreign scope fails closed without state mutation',()=>{const h=harness();const before=JSON.stringify(h.g);assert(!h.command('免除不存在州田赋一年').ok);assert(!h.command('免除外国地区田赋一年').ok);assert.equal(JSON.stringify(h.g),before);});
test('no-action prohibitions do not reverse into exemptions',()=>{const h=harness();assert(!h.command('陕西不得免征田赋').ok);assert.equal(h.amount('sx'),100);});
test('sub-turn duration is prorated by the real assessment period',()=>{const h=harness();assert(h.command('免除全国赋税十五天').ok);assert.equal(h.amount('sx'),50);});
test('ownership changes cannot extend a prior exemption to a foreign treasury',()=>{const h=harness();assert(h.command('免除全国赋税一年').ok);h.g.mapData.regions[0].owner='other';assert.equal(h.amount('sx'),100);});
test('save round-trip preserves expiry, receipts and assessment',()=>{const h=harness();const r=h.command('陕西免田赋三个月');const g=JSON.parse(JSON.stringify(h.g));h.c.GM=g;g.turn=3;assert.equal(h.c.TM.TaxPolicy.effectiveTax(g,g.adminHierarchy['本朝'].divisions[0],g.fiscalConfig.taxList[0],{turnDays:30}).rate,0);g.turn=4;assert.equal(h.c.TM.TaxPolicy.effectiveTax(g,g.adminHierarchy['本朝'].divisions[0],g.fiscalConfig.taxList[0],{turnDays:30}).rate,.1);assert(g.fiscalConfig.taxPolicies.some(p=>p.id===r.receiptIds[0]));});
test('native fiscal uses the same effective policy without changing tax authority or balances',()=>{
 const h=harness(),g=h.g,c=h.c;g.startContext={playerFactionId:'own'};c.TM.NativeWorld={enabled:()=>true};
 g.nativeWorld={accounts:[{id:'public',name:'地块税收',ownerFactionId:'own',kind:'public',resource:'money',unit:'两',flowModel:{type:'region-tax',periodDays:30,rate:.1}}]};
 g.mapData.regions=[{id:'sx',name:'陕西',taxAuthorityFactionId:'own',taxBase:1000,taxBaseResource:'money',taxBaseUnit:'两'}];
 assert.equal(c.TM.NativeFiscal.taxReceipts(g,30)[0].amount,100);assert(h.command('免除全国赋税一年').ok);assert.equal(c.TM.NativeFiscal.taxReceipts(g,30)[0].amount,0);assert.equal(g.mapData.regions[0].taxAuthorityFactionId,'own');assert.equal(g.guoku.money,1234);
});
test('policy application is side-effect-free on failure of any clause',()=>{const h=harness(),s=JSON.stringify(h.g);assert(!h.command('免除陕西田赋一年；免除不存在州商税一年').ok);assert.equal(JSON.stringify(h.g),s);});
test('unsupported new-tax instruction cannot return false success',()=>{const h=harness();const r=h.c.EdictParser.tryExecute('全国商税按户税率20%',{},{});assert(!r.ok);assert.equal(h.g.fiscalConfig.customTaxes,undefined);});
test('unknown tax name cannot exempt all other taxes',()=>{const h=harness(),before=JSON.stringify(h.g);assert(!h.command('免除全国奢侈税一年').ok);assert.equal(JSON.stringify(h.g),before);});
test('plain tax-rate instruction applies its explicit value',()=>{const h=harness();assert(h.command('全国商税税率调整为15%').ok);assert.equal(h.amount('sx',1),150);});
test('increase-tax wording never reverses into a tax cut',()=>{const h=harness();assert(h.command('全国赋税加税一成').ok);assert.equal(h.amount('sx'),110);});

test('mixed regional actions fail safely rather than taxing both regions identically',()=>{const h=harness(),s=JSON.stringify(h.g);assert(!h.command('陕西免田赋，河南提高田赋20%').ok);assert.equal(JSON.stringify(h.g),s);});
test('future exemption is not silently applied before its effective date',()=>{const h=harness(),s=JSON.stringify(h.g);assert(!h.command('明年免除全国赋税一年').ok);assert.equal(JSON.stringify(h.g),s);});

test('research does not enact the proposed tax policy',()=>{const h=harness(),s=JSON.stringify(h.g);assert(!h.command('命甲臣研究全国免税一年的可行性').ok);assert.equal(JSON.stringify(h.g),s);});
test('conditional tax commands do not execute before the condition is met',()=>{const h=harness(),s=JSON.stringify(h.g);assert(!h.command('核验后免除陕西田赋一年').ok);assert.equal(JSON.stringify(h.g),s);});

console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
