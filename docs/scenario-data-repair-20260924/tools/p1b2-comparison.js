// 汇总已完成的真实VM凭证；金额不一致即报错，防止无意改动既有税表/收入。
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const DIR=path.resolve(__dirname,'..'),R=path.join(DIR,'reports');
const taxIds={tianqi:{盐课:['salt_iron'],坑冶:[],市舶:['guanshui'],马匹:[],渔课:[],皇庄:[],茶马司:['chama']},
 shaosong:{盐课:['yanke'],坑冶:['kuangye'],市舶:['shibo'],马匹:[],渔课:[],皇庄:[],茶课:['chake']},
 tang:{盐课:['salt_iron','salt_hedong','salt_sichuan','salt_retained'],坑冶:['mining'],市舶:['maritime'],马匹:[],渔课:[],皇庄:[],茶课:['tea']}};
const names={tianqi:'天启',shaosong:'绍宋',tang:'晚唐'},fields={saltProduction:'盐产（斤/年）',mineralProduction:'计价矿产/年',horseProduction:'马（匹/年）',fishingProduction:'计价渔产/年',maritimeTradeVolume:'海贸计价量/年',imperialFarmland:'皇庄（亩）'};
const rows=[],output=[],retention=[];
const money=n=>Number(n.toFixed(4)).toLocaleString('en-US',{maximumFractionDigits:4});
for(const key of Object.keys(names)) {
 const a=JSON.parse(fs.readFileSync(path.join(R,'p1b2-before-'+key+'.json'))),b=JSON.parse(fs.readFileSync(path.join(R,'p1b2-after-'+key+'.json')));
 assert.deepStrictEqual(Object.keys(a.taxes).sort(),Object.keys(b.taxes).sort(),key+' 税目集合变化');
 for(const id of Object.keys(a.taxes))for(const k of ['central','local','nominal'])assert(Math.abs(a.taxes[id][k]-b.taxes[id][k])<0.001,key+' '+id+' '+k+'意外变动');
 assert(b.authoredRetention && !b.authoredRetention.mismatches.length,key+' 开局产量未验真');
 retention.push('- '+names[key]+'：开局逐字段比较 '+b.authoredRetention.compared+' 项，改写 0 项。');
 for(const [name,ids] of Object.entries(taxIds[key])) {
   function sum(r,k){return ids.reduce((n,id)=>n+r.taxes[id][k],0);}
   rows.push('| '+[names[key]+'（'+b.unit.money+'）',name,ids.length?ids.map(id=>b.taxes[id].base).join(' / '):'未单列此字段税目',money(sum(a,'central')),money(sum(b,'central')),money(sum(a,'local')),money(sum(b,'local'))].join(' | ')+' |');
 }
 for(const [field,label] of Object.entries(fields)) output.push('| '+[names[key],label,money(a.sourceProduction.sums[field]),money(b.sourceProduction.sums[field]),money(a.openingProduction.sums[field]),money(b.openingProduction.sums[field]),money(b.settledProduction.sums[field])].join(' | ')+' |');
}
const md=['# P1-B2 开局探针对比','',
 '两侧均为真开局后强制征收360天，原版为c9ad8e6f，修复版为本工作区。未推进AI、战争、人口和支出；legacy税制按365天折年，晚唐账本按360天。中央与地方均为实收，不含胥吏截留和在途损失。完整精度及名义税额见同目录JSON。','',
 '## 收入','', '| 剧本/币种 | 项目 | 实际税基 | 原中央 | 新中央 | 原地方 | 新地方 |','| --- | --- | --- | ---: | ---: | ---: | ---: |',...rows,'',
 '全部既有税目逐项比较，中央、地方、名义税额均无变化。马匹、渔产和皇庄一列的0仅指未单列这种直接税目，不能解释为无产业、无马政实物产出或全部内帑收入为0。茶马司/茶课另列，不能算作产马收入。','',
 '## 物产','', '| 剧本 | 项目 | 原JSON登记合计 | 新JSON登记合计 | 原真实开局 | 新真实开局 | 修复后360天结算后 |','| --- | --- | ---: | ---: | ---: | ---: | ---: |',...output,'',
 'JSON登记合计不含缺字段；特别是晚唐，缺项会由原有初始化补默认量。矿产的新登记总计是来源推算的模型计价值；不是产出银两重量。皇庄在开局被保留，此后随田亩的兼并、垦荒等变化。','',
 '## 首回合原值保留','',...retention,'',
 '史料口径、假设、尚未考定字段及税基重接的待决项见 [P1-B2说明](../P1-B2说明.md)。',''];
fs.writeFileSync(path.join(R,'p1b2-comparison.md'),md.join('\n'));
console.log('PASS monetary receipts unchanged; all authored opening fields retained');
