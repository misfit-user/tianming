// Independently verify measured elasticity/stability and document historical scale without calibrating rates.
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const DIR=path.resolve(__dirname,'..'),R=path.join(DIR,'reports'),FIELDS=['saltProduction','mineralProduction','maritimeTradeVolume'];
const read=(key,side)=>JSON.parse(fs.readFileSync(path.join(R,`tax-base-${key}-${side}.json`),'utf8'));
const sums=(report,select)=>Object.entries(report.taxes).filter(([id,t])=>select(id,t)).reduce((a,[,t])=>({nominal:a.nominal+t.nominal,central:a.central+t.central,local:a.local+t.local}),{nominal:0,central:0,local:0});
const out={method:'360-day actual collection; money, grain and cloth kept separate',scenarios:[],benchmarks:[]};
for(const key of ['tianqi','shaosong','tang']){
 const b=read(key,'before'),a=read(key,'after'),legacy=JSON.parse(fs.readFileSync(path.join(R,`tax-base-legacy-${key}.json`),'utf8'));
 assert(legacy.legacyCompatibility.allTaxRowsAndDestinationsIdentical,key+' legacy verification absent');
 assert.deepStrictEqual(legacy.taxes,b.taxes,key+' old-reference rerun disagrees with captured baseline');
  if(key==='tianqi'){
    // 开局不再预走一次土地结算，实测税基时点已变；严格核对未改税目的声明及辽饷分账。
    const data=require('../data/tianqi-tax-base'),s=JSON.parse(fs.readFileSync(path.join(DIR,'../../scenarios',data.scenario),'utf8'));
    for(const id of ['liaoxiang','chama','chaoguan','junhu'])assert.deepStrictEqual(s.fiscalConfig.customTaxes.find(t=>t.id===id),data.legacy.customTaxes.find(t=>t.id===id),id+' unchanged tax declaration drifted');
    assert.deepStrictEqual(s.fiscalConfig.centralLocalRules.perTax.liaoxiang,{qiyun:1,cunliu:0});
  }
 const rows=[];
 for(const[id,t]of Object.entries(a.taxes)){
   if(!FIELDS.includes(t.base)&&!(key==='tang'&&/FiscalAssessment$/.test(t.base)))continue;
   const byFactor=f=>a.sensitivity.find(x=>x.driver==='production'&&x.factor===f).taxes[id]||{nominal:0};
   const declared=FIELDS.includes(t.base);
   for(const f of [.8,1.2])assert(Math.abs(byFactor(f).nominal-t.nominal*(declared?f:1))<0.001,id+' production response');
   for(const f of [.8,1.2]){const s=a.sensitivity.find(x=>x.driver==='population-held-production'&&x.factor===f).taxes[id]||{nominal:0};assert(Math.abs(s.nominal-t.nominal)<0.001,id+' still taxes population');}
   const first=a.turns[0].taxes[id],last=a.turns.at(-1).taxes[id];
   for(const k of ['nominal','central','local'])assert(Math.abs(first[k]-last[k])<0.001,id+' drifts with fixed drivers');
   rows.push({id,base:t.base,productionElasticity:declared?1:0,populationDirectElasticity:0,sixTurnMoneyDrift:0});
 }
 const moneyBefore=sums(b,(_,t)=>t.resource==='money'),moneyAfter=sums(a,(_,t)=>t.resource==='money');
 out.scenarios.push({key,unit:a.unit,moneyBefore,moneyAfter,native:a.native,previewMatches:a.previewMatches,legacyIdentical:true,responses:rows});
}
function benchmark(key,label,select,annualReference,caveat){
 const a=read(key,'after'),q=sums(a,select),year=key==='tang'?360:365,annualReceipt=(q.central+q.local)*year/360;
 out.benchmarks.push({key,label,annualReference,annualizedModelReceipt:annualReceipt,shortfall:annualReference-annualReceipt,shortfallPercent:(1-annualReceipt/annualReference)*100,caveat});
}
benchmark('tianqi','十运司有据课银',id=>id.startsWith('salt_'),require('../data/tianqi-tax-base').salt.reduce((n,g)=>n+g.receipts,0),'将史载课银作为模型名义基准后仍扣原游戏征收损耗；不少引文为岁入，故模型实收明显低，不用提高单位价掩盖。额盐、余课和年份范围也不完全相同。');
benchmark('tianqi','月港诸饷二万九千下限',id=>id==='guanshui',29000,'万历二十二年跨年参照含水陆加增，本模型只有陆饷，非同口径同年账。');
benchmark('shaosong','淮浙盐课庆元参照',id=>id==='yanke',9908000,'庆元不同于建炎；现有产量取北宋旧额、价取南渡，且模型收入未另扣未知亭户工本，只作量级参照。');
benchmark('shaosong','抽解与和买合数',id=>id==='shibo',2000000,'含和买，不能全视税收。缺可分离的同期纯抽解年额；按审查授权回退原commerceVolume估算，未用二百万目标校准产值或系数。');
benchmark('tang','大历末盐利六百万下限',id=>id==='salt_iron',6000000,'大历末早于840，且东南海盐范围不必与引文严格相同，只作参照。');
benchmark('tang','两池实钱定额',id=>id==='salt_hedong',1000000,'史料是定额，本模型名义恰百万；实收扣原征解损耗。');
benchmark('tang','坑冶七万余下限',id=>id==='mining',70000,'模型实际地方留用7.5万，比下限多0.5万；模型名义约15.3244万，不能把实收写成名义。');
fs.writeFileSync(path.join(R,'tax-base-evidence.json'),JSON.stringify(out,null,2)+'\n');
console.log('PASS measured elasticities, six-turn stability, legacy replay and benchmark arithmetic');
