import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ctx={console,Math,JSON,RegExp,Array,Object,String,Number,Boolean,parseInt,parseFloat,isNaN,setTimeout(){},clearTimeout(){},document:{getElementById:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{}}),body:{},addEventListener(){}},GM:{turn:1,officeTree:[],chars:[],evtLog:[]},TM:{errors:{capture(){},captureSilent(){}}},addEB(){},showToast(){},toast(){},alert(){},autoSave(){},_dbg(){},escHtml:v=>String(v??''),findCharByName:()=>null};
ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'web/tm-office-system.js'),'utf8'),ctx);
const tests=[
 [{officialTitle:'刑部尚书·盐铁转运使',officialTitles:['刑部尚书·盐铁转运使','刑部尚书','盐铁转运使'],concurrentTitles:['刑部尚书','盐铁转运使']},'刑部尚书·盐铁转运使'],
 [{officialTitle:'刑部尚书',concurrentTitles:['刑部尚书·盐铁转运使','盐铁转运使']},'刑部尚书　兼　盐铁转运使'],
 [{officialTitle:'礼部尚书',concurrentTitles:['东阁大学士']},'礼部尚书　兼　东阁大学士'],
 [{officialTitle:'内阁首辅·建极殿大学士',concurrentTitles:['礼部尚书','吏部尚书']},'内阁首辅·建极殿大学士　兼　礼部尚书、吏部尚书'],
 [{officialTitle:'检校礼部尚书',concurrentTitles:['礼部尚书']},'检校礼部尚书　兼　礼部尚书'],
 [{officialTitle:'太子宾客·分司东都',concurrentTitles:['太子宾客']},'太子宾客·分司东都'],
 [{officialTitle:'尚书左仆射',concurrentTitles:['检校尚书左仆射']},'尚书左仆射　兼　检校尚书左仆射'],
 [{officialTitle:'盐铁推官',concurrentTitles:['检校礼部郎中']},'盐铁推官　兼　检校礼部郎中'],
 [{officialTitle:'主官（署甲、乙）',concurrentTitles:['主官（署甲、乙）']},'主官（署甲、乙）'],
 [{officialTitle:'门下侍郎·同平章事',concurrentTitles:['门下侍郎','同平章事']},'门下侍郎·同平章事']
];
let count=0;
for(const [c,expected] of tests){const before=JSON.stringify(c);assert.equal(ctx._offFormatCharTitles(c),expected);assert.equal(JSON.stringify(c),before);count+=2;}
assert.equal(ctx._offGetCharOfficeTitles(tests[0][0]).length,3,'mechanism getter must retain its old non-display contract');count++;
console.log('PASS office display dedupe assertions='+count);
const dutyCases=JSON.parse(fs.readFileSync(path.join(root,'docs/late-tang-person-20260917/office-duty-cases.json'),'utf8'));
for(const [claim,dept,slot] of dutyCases){
 for(const existing of [false,true]){assert.equal(ctx._offTitleSlotScore(claim,dept,slot,existing),0,claim);count++;}
 assert(ctx._offTitleSlotScore(claim,dept,claim,false)>=98);count++;
}
assert(ctx._offTitleSlotScore('权知开封府','开封府','知开封府',false)>=40);count++;
assert.equal(ctx._offFormatCharTitles({officialTitle:'谏议大夫·兼起居舍人',concurrentTitles:['起居舍人']}),'谏议大夫·兼起居舍人');count++;
console.log('PASS complete office regression assertions='+count);
const holder={officialTitle:'河中节度使',title:'河中节度使·河中尹·晋绛观察使',officialTitles:['河中节度使','河中尹','晋绛观察使'],concurrentTitles:['河中尹','晋绛观察使']};
ctx._offAddCharOfficeTitle(holder,'河中节度使',{concurrent:true});
assert.deepEqual(Array.from(holder.concurrentTitles),['河中尹','晋绛观察使']);count++;
const once=JSON.stringify(holder);ctx._offAddCharOfficeTitle(holder,'河中节度使',{concurrent:true});assert.equal(JSON.stringify(holder),once);count++;
ctx._offAddCharOfficeTitle(holder,'户部尚书',{concurrent:false});assert.deepEqual(Array.from(holder.officialTitles),['户部尚书']);count++;
console.log('PASS office title import idempotency assertions='+count);
