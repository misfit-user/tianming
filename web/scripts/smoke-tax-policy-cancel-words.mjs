// 税令废止句式（2026-10-13）：「取消/废除/撤销/革除/停收 三饷(辽饷/剿饷/练饷)」按全免登记；「三饷」=三种加派合称。
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=process.env.TM_TEST_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const overlay=process.env.TM_TEST_OVERLAY;const read=f=>fs.readFileSync(overlay&&fs.existsSync(path.join(overlay,f))?path.join(overlay,f):path.join(root,f),'utf8');
let passed=0,failed=0;function test(name,f){try{f();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' '+e.stack);}}
function harness(){
 const g={turn:1,playerInfo:{factionId:'own',factionName:'本朝'},facs:[{id:'own',name:'本朝'}],chars:[],guoku:{money:1234},
  fiscalConfig:{taxList:[
   {id:'land',name:'田赋',base:'arableLand',rate:.1,annual:false,storeAs:'money'},
   {id:'liaoxiang',name:'辽饷',base:'arableLand',rate:.05,annual:false,storeAs:'money'},
   {id:'jiaoxiang',name:'剿饷',base:'arableLand',rate:.02,annual:false,storeAs:'money'},
   {id:'lianxiang',name:'练饷',base:'arableLand',rate:.02,annual:false,storeAs:'money'}]},
  adminHierarchy:{'本朝':{divisions:[{id:'sx',name:'陕西',economyBase:{farmland:1000,commerceVolume:1000}},{id:'hn',name:'河南',economyBase:{farmland:1000,commerceVolume:1000}}]}},
  mapData:{regions:[{id:'sx',name:'陕西',owner:'own'},{id:'hn',name:'河南',owner:'own'}]}};
 const c={console,GM:g,P:{time:{daysPerTurn:30}},setTimeout(){},clearTimeout(){},addEB(){},toast(){}};c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-fiscal-engine.js','tm-edict-parser.js','tm-tax-policy.js','tm-native-fiscal-adapter.js'])vm.runInContext(read('web/'+f),c,{filename:f});
 const command=text=>c.EdictParser.tryExecute(text,{},{});
 const amount=(id,tax=0,days=30)=>c.FiscalEngine.assessTax(g.adminHierarchy['本朝'].divisions.find(d=>d.id===id),g.fiscalConfig.taxList[tax],{game:g,accountingV2:true,fiscalConfig:g.fiscalConfig,turnDays:days});
 return{g,c,command,amount};
}
test('「全国取消三饷」把辽饷、剿饷、练饷三种加派一并免掉，田赋不动',()=>{const h=harness();assert.equal(h.amount('sx',1),50);const r=h.command('全国取消三饷');assert(r.ok,JSON.stringify(r));assert.equal(h.amount('sx',1),0);assert.equal(h.amount('hn',2),0);assert.equal(h.amount('sx',3),0);assert.equal(h.amount('sx',0),100);assert.equal(h.g.guoku.money,1234);});
test('「废除辽饷」「撤销剿饷」「全国停收练饷」各自只免对应一种',()=>{const h=harness();assert(h.command('全国废除辽饷').ok);assert.equal(h.amount('sx',1),0);assert.equal(h.amount('sx',2),20);assert(h.command('全国撤销剿饷').ok);assert.equal(h.amount('sx',2),0);assert.equal(h.amount('sx',3),20);assert(h.command('全国停收练饷').ok);assert.equal(h.amount('sx',3),0);});
test('「陕西革除辽饷」只免陕西',()=>{const h=harness();assert(h.command('陕西革除辽饷').ok);assert.equal(h.amount('sx',1),0);assert.equal(h.amount('hn',1),50);});
test('「不得取消辽饷」「未经奏准不许废除三饷」不会反向变成免征',()=>{const h=harness();const s=JSON.stringify(h.g);assert(!h.command('全国不得取消辽饷').ok);assert(!h.command('未经奏准不许废除三饷').ok);assert.equal(JSON.stringify(h.g),s);assert.equal(h.amount('sx',1),50);});
test('取消三饷后再复征恢复原额',()=>{const h=harness();assert(h.command('全国取消三饷').ok);assert.equal(h.amount('sx',1),0);assert(h.command('全国恢复辽饷').ok);assert.equal(h.amount('sx',1),50);assert.equal(h.amount('sx',2),0);});
// 2026-10-14：龙门-崇宝实测「减至三成」被当成税率本身（田赋每亩一分四厘→三钱，涨二十多倍）。
test('「陕西田赋减至三成」=减到原额的三成，只动陕西',()=>{const h=harness();assert.equal(h.amount('sx',0),100);const r=h.command('陕西田赋减至三成');assert(r.ok,JSON.stringify(r));assert.equal(h.amount('sx',0),30);assert.equal(h.amount('hn',0),100);assert.equal(h.amount('sx',1),50);});
test('「全国辽饷减为五成」「全国剿饷降至五成」「全国练饷减到五成」都是打五折',()=>{const h=harness();assert(h.command('全国辽饷减为五成').ok);assert.equal(h.amount('sx',1),25);assert(h.command('全国剿饷降至五成').ok);assert.equal(h.amount('sx',2),10);assert(h.command('全国练饷减到五成').ok);assert.equal(h.amount('sx',3),10);});
test('「全国田赋提高到两成」两种读法都通，不猜，整档不动',()=>{const h=harness();const s=JSON.stringify(h.g);const r=h.command('全国田赋提高到两成');assert(!r.ok,JSON.stringify(r));assert(/两种读法/.test(JSON.stringify(r)),JSON.stringify(r));assert.equal(JSON.stringify(h.g),s);assert.equal(h.amount('sx',0),100);});
test('「减至3%」只往下走：现额已低于目标的辽饷不动，田赋减到 3%',()=>{const h=harness();assert(h.command('全国田赋减至3%').ok);assert.equal(h.amount('sx',0),30);assert(h.command('全国辽饷减至8%').ok);assert.equal(h.amount('sx',1),50);});
test('「税率提高到5%」只往上走：田赋现额 10% 不会被压到 5%，剿饷从 2% 提到 5%',()=>{const h=harness();assert(h.command('全国田赋税率提高到5%').ok);assert.equal(h.amount('sx',0),100);assert(h.command('全国剿饷税率提高到5%').ok);assert.equal(h.amount('sx',2),50);});
test('「田赋加征两成」「田赋减征三成」老写法不受影响',()=>{const h=harness();assert(h.command('全国田赋加征两成').ok);assert.equal(h.amount('sx',0),120);assert(h.command('全国辽饷减征三成').ok);assert.equal(h.amount('sx',1),35);});
// 2026-10-17 复审（Astra 6）：否定词与「取消」隔得远时原来只看 4 个字，整句被登记成全免
test('长否定：「全国不得未经奏准且未查明实情就取消三饷」不登记全免，整档不动',()=>{const h=harness();const s=JSON.stringify(h.g);const r=h.command('全国不得未经奏准且未查明实情就取消三饷');assert(!r.ok,JSON.stringify(r));assert.equal(JSON.stringify(h.g),s);assert.equal(h.amount('sx',1),50);});
test('长否定：「各省严禁借灾情之名擅自停收辽饷」不登记停征',()=>{const h=harness();const s=JSON.stringify(h.g);assert(!h.command('全国各省严禁借灾情之名擅自停收辽饷').ok);assert.equal(JSON.stringify(h.g),s);});

console.log(`${passed} passed / ${failed} failed`);process.exit(failed?1:0);
